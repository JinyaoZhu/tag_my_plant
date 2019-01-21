var g_xmlDoc;

var g_path_to_database_root = '';
var g_database_zip_url = '';
var g_database_root = cordova.file.externalDataDirectory + 'database/' + g_path_to_database_root;
var g_data_xml_path = g_database_root + "components.xml";
var g_app_root = window.location.href.replace("index.html", "");

var g_zip_download_path = cordova.file.externalCacheDirectory;
var g_zip_extract_path = cordova.file.externalDataDirectory;

var g_component_search_list;

var g_keep_awake;

//var xmldaUrl = 'http://141.30.154.211:8087/OPC/DA';
var g_opc_da_server_url;
var g_opc_da_data = {};
var g_opc_da_status = false;
var g_current_displayed_component_no = null;

var SearchMethod = {
  BY_ID: "id",
  BY_CODE: "code",
};

var BOOL_STR = {
  true_t: "true",
  false_t: "false",
};

var g_search_method;
var g_code_scanner = "";

document.addEventListener("deviceready", onDeviceReady, false);

function onDeviceReady() {
  // start an interval timer
  var mainloopid = setInterval(mainloop, 1000);
  function mainloop() {
    if (g_keep_awake === BOOL_STR.true_t) {
      // call the plugin every (say) one second to keep your app awake
      window.plugins.insomnia.keepAwake();
    }
    else {
      window.plugins.insomnia.allowSleepAgain();
    }
    sendSoapReadMessage();
  }
}

document.addEventListener('init', function (event) {
  var page = event.target;

  if(page.id === "tabbarPage"){
      // Set button functionality to open/close the menu.
      page.querySelector('[component="button/search"]').onclick = function() {
        document.querySelector('#mySplitter').left.toggle();
        onSearchClick();
      };
  
      Array.prototype.forEach.call(page.querySelectorAll('[component="button/settings"]'), function(element) {
        element.onclick = function() {
          document.querySelector('#myNavigator').pushPage('html/settings.html');
        };
  
        element.show && element.show(); // Fix ons-fab in Safari.
      });
  
      Array.prototype.forEach.call(page.querySelectorAll('[component="button/help"]'), function(element) {
        element.onclick = function() {
          document.querySelector('#myNavigator').pushPage('html/help.html');
        };
  
        element.show && element.show(); // Fix ons-fab in Safari.
      });
  
      // Change tabbar animation depending on platform.
      page.querySelector('#myTabbar').setAttribute('animation', ons.platform.isAndroid() ? 'slide' : 'none');
  }

  if (page.id === "mainPage") {
    scannerInput();
    showWelcome();
    opcStatusImgSetRed();
  }

  if (page.id === "searchPage") {
    // ons.notification.alert('Load searchPage');
    document.querySelector('#mySplitter').left.setAttribute('animation', ons.platform.isAndroid() ? 'overlay' : 'reveal');
    initComponentList();
  }

  if (page.id === "settingsPage") {
    // ons.notification.alert('Load settingsPage');
    Array.prototype.forEach.call(page.querySelectorAll('[component="button/about"]'), function(element) {
      element.onclick = function() {
        document.querySelector('#myNavigator').pushPage('html/about.html');
      };

      element.show && element.show(); // Fix ons-fab in Safari.
    });

    loadSetting();
    if (g_search_method == SearchMethod.BY_ID) {
      document.querySelector('#cfg-search-id').checked = true;
      document.querySelector('#cfg-search-code').checked = false;
    }
    else if (g_search_method == SearchMethod.BY_CODE) {
      document.querySelector('#cfg-search-id').checked = false;
      document.querySelector('#cfg-search-code').checked = true;
    }

    // console.log(g_keep_awake);

    if (g_keep_awake === BOOL_STR.true_t)
      document.querySelector('#keep-awake-switch').checked = true;
    else
      document.querySelector('#keep-awake-switch').checked = false;

    document.querySelector('#download-input').value = g_database_zip_url;
    document.querySelector('#database-path-input').value = g_path_to_database_root;
    document.querySelector('#opc-server-url-input').value = g_opc_da_server_url;
  }

  if (page.id === "helpPage") {
    document.querySelector("#help_database_path_img").src = g_app_root + "img/help/database_path.PNG";
    document.querySelector("#help_xml_img").src = g_app_root + "img/help/xml.PNG";
  }

  if (page.id === "aboutPage") {
    document.querySelector("#about_logo_img").src = g_app_root + "img/tagmyplant.png";
  }
});

document.addEventListener('hide', function (event) {
  var page = event.target;
  if (page.id === "settingsPage") {
    saveSetting();
    sortList(g_search_method, g_component_search_list);
  }
});

function initComponentList() {
  loadSetting();
  g_component_search_list = document.querySelector('#component-list');
  removeAllChild('component-list');
  g_xmlDoc = getXmlFile(g_data_xml_path);
  if (g_xmlDoc) {
    createList(g_component_search_list, g_xmlDoc);
    sortList(g_search_method, g_component_search_list);
    return true;
  }
  else {
    return false;
  }
}

function removeAllChild(id) {
  var node = document.getElementById(id);
  while (node.firstChild) {
    node.removeChild(node.firstChild);
  }
}

function sortList(search_method, list) {
  if (search_method === SearchMethod.BY_ID) {
    sortListById(list, "#no");
  }
  else if (search_method === SearchMethod.BY_CODE) {
    sortListById(list, "#code");
  }
  setSearchPlaceholder(search_method, 'search-input-bar');
}

function setSearchPlaceholder(search_method, id) {
  if (search_method === SearchMethod.BY_ID)
    document.getElementById(id).setAttribute("placeholder", 'Enter ID');
  else if (search_method === SearchMethod.BY_CODE)
    document.getElementById(id).setAttribute("placeholder", 'Enter Code');
  // alert('set placeholder');
}

document.addEventListener('show', function (event) {

});

var setPdfPath = function (path) {
  var pdfjs_path = "lib/pdfjs/web/viewer.html";
  var pdf_path = path;
  document.getElementById("pdfViwer").src = pdfjs_path + "?file=" + pdf_path;
  // ons.notification.alert(window.location.href);
  // document.getElementById("debug-info1").innerHTML = pdf_path;
  // ons.notification.alert('Alert');
};

function getXmlFile(xml_path) {
  if (window.XMLHttpRequest) {
    xmlhttp = new XMLHttpRequest();
  }
  else {
    xmlhttp = new ActiveXObject("Microsoft.XMLHTTP");
  }
  xmlhttp.open("GET", xml_path, false);
  xmlhttp.send();
  return xmlhttp.responseXML;
}

function createList(list, xml_file) {
  var x = xml_file.getElementsByTagName("COMPONENT");
  for (i = 0; i < x.length; i++) {
    var no = x[i].getElementsByTagName("NO")[0].childNodes[0].nodeValue;
    var code = x[i].getElementsByTagName("CODE")[0].childNodes[0].nodeValue;
    var Item = ons.createElement(
      '<ons-list-item tappable modifier="longdivider" onclick="onItemClick(this)">' +
      "<div class='left' id='code'>" +
      code +
      "</div>" +
      "<div class='right' id='no'>" +
      no +
      "</div>" +
      '</ons-list-item>'
    );
    list.appendChild(Item);
  }
}

function toggleSearchBar() {
  document.querySelector('#mySplitter').left.toggle();
}

function onItemClick(element) {
  var code = element.querySelector("#code").textContent;
  // ons.notification.alert(this);
  setTimeout(function () {
    toggleSearchBar();
    updateCompData(code, g_xmlDoc);
    document.querySelector("#search-input").value = "";
    setSearchPlaceholder(g_search_method, 'search-input-bar');
  }, 150);

}

function swapElements(obj1, obj2) {
  obj2.nextSibling === obj1
    ? obj1.parentNode.insertBefore(obj2, obj1.nextSibling)
    : obj1.parentNode.insertBefore(obj2, obj1);
}

function sortListById(list, id) {
  var rows, switching, i, x, y, shouldSwitch;
  switching = true;
  /*Make a loop that will continue until
  no switching has been done:*/
  while (switching) {
    //start by saying: no switching is done:
    switching = false;
    rows = list.querySelectorAll(id);
    // console.log(rows);
    for (i = 0; i < (rows.length - 1); i++) {
      //start by saying there should be no switching:
      shouldSwitch = false;
      /*Get the two elements you want to compare,
      one from current row and one from the next:*/
      x = rows[i].textContent;
      y = rows[i + 1].textContent;
      //check if the two rows should switch place:
      if (x.toLowerCase() > y.toLowerCase()) {
        //if so, mark as a switch and break the loop:
        shouldSwitch = true;
        break;
      }
    }
    if (shouldSwitch) {
      /*If a switch has been marked, make the switch
      and mark that a switch has been done:*/
      var items = list.querySelectorAll("ons-list-item");
      swapElements(items[i], items[i + 1]);
      switching = true;
    }
  }
}

function onSearchInput(event) {
  var input = document.querySelector("#search-input");
  matchSearch(input.value, g_component_search_list, g_search_method);
}

function setComponentImage(path) {
  var img = document.getElementById("component-image");
  img.src = path;
  // alert(path);
  // img.style.height = "100px;";
}

function scannerInput() {
  document.onkeyup = function (e) {
    if (document.activeElement == document.getElementById("search-input"))
      return;
    if (e.keyCode == 13) {
      // ons.notification.alert(g_code_scanner);
      updateCompData(g_code_scanner, g_xmlDoc)
      ons.notification.toast('Scaned Code: ' + g_code_scanner, { timeout: 1000, animation: 'fall' });
      g_code_scanner = "";
    }
    else
      g_code_scanner += String.fromCharCode(e.keyCode);
  };
}

function findCompIndex(code, xmlDoc) {
  var index;
  var match_cout = 0;
  var x = xmlDoc.getElementsByTagName("COMPONENT");

  for (i = 0; i < x.length; i++) {
    if (x[i].getElementsByTagName("CODE")[0].childNodes[0].nodeValue === code) {
      match_cout++;
      index = i;
    }
  }

  if (match_cout == 1)
    return index;
  else if (match_cout == 0)
    return -1;
  else {
    alert("error: multiple matching!");
    return -1;
  }
}

function updateCompData(code, xmlDoc) {
  // alert(tableRow.cells[0].innerHTML);
  // document.getElementById("compImg").src = './data/KVA-datasheets/B1/basin_B1_pic.PNG';
  var index = findCompIndex(code, xmlDoc);
  var x = xmlDoc.getElementsByTagName("COMPONENT");
  if (index != -1) {
    var component_title_name;
    var component_title_no;
    var img_path;
    var pdf_path;
    component_title_name = x[index].getElementsByTagName("NAME")[0].childNodes[0].nodeValue;
    component_title_no = x[index].getElementsByTagName("NO")[0].childNodes[0].nodeValue;
    img_path = x[index].getElementsByTagName("PICTURE")[0].childNodes[0].nodeValue;
    pdf_path = x[index].getElementsByTagName("DATASHEET")[0].childNodes[0].nodeValue;

    document.getElementById("component-title-name").innerHTML = component_title_name;
    document.getElementById("component-title-no").innerHTML = component_title_no;

    setComponentImage(g_database_root + img_path);
    setPdfPath(g_database_root + pdf_path);

    var design, note, func;

    design = x[index].getElementsByTagName("DESIGN")[0].childNodes[0];
    note = x[index].getElementsByTagName("NOTE")[0].childNodes[0];
    func = x[index].getElementsByTagName("FUNCTION")[0].childNodes[0];

    document.getElementById("component-design").innerHTML = design != undefined ? design.nodeValue : "none.";
    document.getElementById("component-function").innerHTML = func != undefined ? func.nodeValue : "none.";
    document.getElementById("component-note").innerHTML = note != undefined ? note.nodeValue : "none.";
    document.getElementById("component-code").innerHTML = code;
    // console.log(document.getElementById("component-design").innerHTML);
    g_current_displayed_component_no = component_title_no;
  }
  else {
    g_current_displayed_component_no = null;
    noMatchUpdate();
  }
  document.querySelector("#mainPage").scrollTop = 0;
  document.querySelector("#datasheetPage").scrollTop = 0;
}

function noMatchUpdate() {
  document.getElementById("component-title-name").innerHTML = "Component not found!";
  document.getElementById("component-title-no").innerHTML = "";
  setComponentImage(g_app_root + 'img/sad.png');
  setPdfPath('');
  document.getElementById("component-design").innerHTML = "none.";
  document.getElementById("component-function").innerHTML = "none.";
  document.getElementById("component-note").innerHTML = "none.";
  document.getElementById("component-code").innerHTML = "none.";
  document.getElementById("component-status").innerHTML = "none.";
}

function showWelcome() {
  document.getElementById("component-title-name").innerHTML = "";
  document.getElementById("component-title-no").innerHTML = "";
  setComponentImage(g_app_root + 'img/tagmyplant.png');
  setPdfPath('');
  document.getElementById("component-design").innerHTML = "none.";
  document.getElementById("component-function").innerHTML = "none.";
  document.getElementById("component-note").innerHTML = "none.";
  document.getElementById("component-code").innerHTML = "none.";
}

var showImgDialog = function (el) {
  if (el.src === "" || el.src.indexOf(g_app_root) == 0)
    return;
  var dialog = document.getElementById('component-img-dialog');

  if (dialog) {
    var img = dialog.querySelector('#dialog-img');
    img.src = el.src;
    dialog.show();
  } else {
    ons.createElement('alert-dialog.html', { append: true })
      .then(function (dialog) {
        var img = dialog.querySelector('#dialog-img');
        img.src = el.src;
        dialog.show();
      });
  }
};

var hideImgDialog = function (id) {
  document
    .getElementById(id)
    .hide();
};


function matchSearch(input, list, search_method) {
  var tmp_list = list.querySelectorAll('ons-list-item');
  if (input.length == 0) {
    for (i = 0; i < tmp_list.length; i++)
      tmp_list[i].style.display = "";
    return;
  }
  var filter = input.toUpperCase();
  var code;
  var codes;
  if (search_method === SearchMethod.BY_ID)
    codes = list.querySelectorAll("#no");
  else if (search_method === SearchMethod.BY_CODE)
    codes = list.querySelectorAll("#code");
  for (var i = 0; i < codes.length; i++) {
    code = codes[i].textContent;
    if (code) {
      if (code.toUpperCase().indexOf(filter) == 0) {
        tmp_list[i].style.display = "";
      }
      else {
        tmp_list[i].style.display = "none";
      }
    }
  }
}

function onSearchClick() {
  document.querySelector('#search-input').focus();
  document.querySelector('#search-input').value = "";
  matchSearch("", g_component_search_list, g_search_method);
}

function onSearchMethodID(el) {
  g_search_method = SearchMethod.BY_ID;
  el.checked = true;
}

function onSearchMethodCode(el) {
  g_search_method = SearchMethod.BY_CODE;
  el.checked = true;
}

function saveSetting() {
  localStorage.setItem("config_search_method", g_search_method);
  localStorage.setItem("config_path_to_database_root", g_path_to_database_root);
  localStorage.setItem("config_database_zip_url", g_database_zip_url);
  localStorage.setItem("config_database_root", g_database_root);
  localStorage.setItem("config_data_xml_path", g_data_xml_path);
  localStorage.setItem("config_keep_awake", g_keep_awake);
  localStorage.setItem("config_opc_da_server_url", g_opc_da_server_url);
  // ons.notification.toast('Settings saved.', { timeout: 300, animation: 'fall' });
}

function loadSetting() {
  if (localStorage.getItem("config_search_method"))
    g_search_method = localStorage.getItem("config_search_method");
  else
    g_search_method = SearchMethod.BY_ID;

  if (localStorage.getItem("config_path_to_database_root"))
    g_path_to_database_root = localStorage.getItem("config_path_to_database_root");
  else
    g_path_to_database_root = '';

  if (localStorage.getItem("config_database_zip_url"))
    g_database_zip_url = localStorage.getItem("config_database_zip_url");
  else
    g_database_zip_url = '';

  if (localStorage.getItem("config_database_root"))
    g_database_root = localStorage.getItem("config_database_root");
  else
    g_database_root = '';

  if (localStorage.getItem("config_data_xml_path"))
    g_data_xml_path = localStorage.getItem("config_data_xml_path");
  else
    g_data_xml_path = '';

  if (localStorage.getItem("config_keep_awake"))
    g_keep_awake = localStorage.getItem("config_keep_awake");
  else
    g_keep_awake = BOOL_STR.true_t;

    if(localStorage.getItem("config_opc_da_server_url"))
    g_opc_da_server_url = localStorage.getItem("config_opc_da_server_url");
    else
    g_opc_da_server_url = '';
}


function onDownloadClick() {
  ons.notification.confirm("Download and update Database?").then((index) => {
    if (index == 1) {
      var input_url = document.querySelector('#download-input');
      var input_path = document.querySelector('#database-path-input');
      var url = input_url.value;
      g_path_to_database_root = input_path.value;
      g_database_zip_url = url;
      setModalText("#modal-download", "Downloading...");
      g_database_root = cordova.file.externalDataDirectory + 'database/' + g_path_to_database_root;
      g_data_xml_path = g_database_root + "components.xml";
      saveSetting();
      showDownloadModal();
      showWelcome();
      downloadZipFile(g_zip_download_path, url);
    }
  });
}

function onDownloadURLClick(el) {
  // if (el.value === "")
  //   el.value = "https://github.com/JinyaoZhu/KVA-Database/archive/master.zip";
}


function downloadZipFile(file_dir, zip_url) {
  window.resolveLocalFileSystemURL(file_dir, function (dirEntry) {
    console.log('file system open: ' + dirEntry.name);
    createFile(dirEntry, "database.zip");
  }, function () { alert('error load file'); });

  function createFile(dirEntry, fileName) {
    // Creates a new file or returns the file if it already exists.
    dirEntry.getFile(fileName, { create: true, exclusive: false }, function (fileEntry) {
      download(fileEntry, zip_url);
    }, function () { alert('error create file'); });
  }

  function download(fileEntry, uri) {

    var fileTransfer = new FileTransfer();
    var fileURL = fileEntry.toURL();

    fileTransfer.download(
      uri,
      fileURL,
      function (entry) {
        onDownloadSuccess();
        console.log("Successful download...");
        console.log("download complete: " + entry.toURL());
      },
      function (error) {
        hideDownloadModal();
        alert("Download error source " + error.source);
        console.log("download error source " + error.source);
        console.log("download error target " + error.target);
        console.log("upload error code" + error.code);
      },
      null, // or, pass false
      {
        //headers: {
        //    "Authorization": "Basic dGVzdHVzZXJuYW1lOnRlc3RwYXNzd29yZA=="
        //}
      }
    );
  }
}

function showDownloadModal() {
  var modal = document.querySelector("#modal-download");
  // modal.textContent = "Downloading from "+document.querySelector('#download-input').value;
  modal.show();
}

function setModalText(id, text) {
  var modal = document.querySelector(id);
  modal.querySelectorAll('p')[1].textContent = text;
}

function hideDownloadModal() {
  var modal = document.querySelector("#modal-download");
  modal.hide();
}

function onDownloadSuccess() {
  // ons.notification.alert("Download success.");
  var zip_path = g_zip_download_path + 'database.zip';
  var extract_path = g_zip_extract_path + 'database';
  deleteFolder(cordova.file.externalDataDirectory + 'database/');
  setModalText("#modal-download", "Decompressing...");
  processZip(zip_path, extract_path);
}

function onUnzipSuccess() {
  hideDownloadModal();
  if (initComponentList())
    ons.notification.alert("Update successfully.");
  else {
    ons.notification.alert("Can not open .xml, check database path.");
  }
}

function onUnzipError() {
  hideDownloadModal();
  ons.notification.alert("Decompress error.");
}

function processZip(zipSource, destination) {
  // Handle the progress event
  var progressHandler = function (progressEvent) {
    var percent = Math.round((progressEvent.loaded / progressEvent.total) * 100);
    // Display progress in the console : 8% ...
    // console.log(percent + "%");
    setModalText("#modal-download", "Decompressing... " + percent + "%");
  };

  // Proceed to unzip the file
  window.zip.unzip(zipSource, destination, (status) => {
    if (status == 0) {
      onUnzipSuccess();
      console.log("Files succesfully decompressed");
    }

    if (status == -1) {
      onUnzipError();
      console.error("Oops, cannot decompress files");
    }
  }, progressHandler);
}

function deleteFolder(file_dir) {
   window.resolveLocalFileSystemURL(file_dir, function (dirEntry) {
    console.log('file system open: ' + dirEntry.name);
    dirEntry.removeRecursively(function () {
      console.log("Remove Recursively Succeeded");
    }, function(){} );
  }, function(){});
}

function onKeepAwakeSwitch(el) {
  if (el.checked)
    g_keep_awake = BOOL_STR.true_t;
  else
    g_keep_awake = BOOL_STR.false_t;
  // console.log(g_keep_awake);
}

function onCleanClick() {
  ons.notification.confirm("Delete Database?").then((index) => {
    if (index == 1) {
      showDownloadModal();
      setModalText("#modal-download", "Deleting database...");
      // TODO: make sure the folder is deleted before function exit
      deleteFolder(cordova.file.externalDataDirectory + 'database/');
      removeAllChild('component-list');
      showWelcome();
      g_current_displayed_component_no = null;
      // ons.notification.alert("Dataset deleted.");
      setTimeout(() => {
        hideDownloadModal();
        ons.notification.alert("Database deleted.");
      }, 2000);
    }
  });
}

// returns the SOAP message that can be used to read the process values
var getSoapReadMessage = function () {
  var soapMessage = '<SOAP-ENV:Envelope xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/" ' +
    '                   xmlns:SOAP-ENC="http://schemas.xmlsoap.org/soap/encoding/" ' +
    '                   xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" ' +
    '                   xmlns:xsd="http://www.w3.org/2001/XMLSchema">' +
    '  <SOAP-ENV:Body>' +
    '    <m:Read xmlns:m="http://opcfoundation.org/webservices/XMLDA/1.0/">' +
    '      <m:Options ReturnErrorText="false" ReturnDiagnosticInfo="false" ReturnItemTime="false" ReturnItemPath="false" ReturnItemName="true"/>' +
    '      <m:ItemList>' +
    '        <m:Items ItemName="Schneider/Fuellstand1_Ist"/>' +
    '        <m:Items ItemName="Schneider/Fuellstand2_Ist"/>' +
    '        <m:Items ItemName="Schneider/Fuellstand3_Ist"/>' +
    '        <m:Items ItemName="Schneider/LH1"/>' +
    '        <m:Items ItemName="Schneider/LH2"/>' +
    '        <m:Items ItemName="Schneider/LH3"/>' +
    '        <m:Items ItemName="Schneider/LL1"/>' +
    '        <m:Items ItemName="Schneider/LL2"/>' +
    '        <m:Items ItemName="Schneider/LL3"/>' +
    '      </m:ItemList>' +
    '    </m:Read>' +
    '  </SOAP-ENV:Body>' +
    '</SOAP-ENV:Envelope>';
  return soapMessage;
}

// sends the SOAP read message via Ajax
var sendSoapReadMessage = function () {
  $.ajax({
    type: 'post',
    url: g_opc_da_server_url,
    crossDomain: true,
    headers: { "SOAPAction": '"http://opcfoundation.org/webservices/XMLDA/1.0/Read"' },
    data: getSoapReadMessage(),
    success: getDataFromReadResponse,
    error: function (response) {
      onAjaxError();
      console.log(response.status);
      console.log("sendSoapReadMessage error");
    }
  });
};

function onAjaxError(){
  g_opc_da_status = false;
  opcStatusImgSetRed();
}

function updateComponentStatus(component_no){
  if(component_no == null){
    document.getElementById("component-status").innerHTML = "none.";
    return;
  }

  if(component_no.indexOf("B1") == 0){ // this is a container
    document.getElementById("component-status").innerHTML = "Level: "+g_opc_da_data.level1;
  }
  else if(component_no.indexOf("B2") == 0){ // this is a container
    document.getElementById("component-status").innerHTML = "Level: "+g_opc_da_data.level2;
  }
  else if(component_no.indexOf("B3") == 0){ // this is a container
    document.getElementById("component-status").innerHTML = "Level: "+g_opc_da_data.level3;
  }
  else if(component_no.indexOf("LH1") == 0){ // this is a proximity sensor
    document.getElementById("component-status").innerHTML = "State: " + g_opc_da_data.level1High;
  }
  else if(component_no.indexOf("LH2") == 0){ // this is a proximity sensor
    document.getElementById("component-status").innerHTML = "State: " + g_opc_da_data.level2High;
  }
  else if(component_no.indexOf("LH3") == 0){ // this is a proximity sensor
    document.getElementById("component-status").innerHTML = "State: " + g_opc_da_data.level3High;
  }
  else if(component_no.indexOf("LL1") == 0){ // this is a proximity sensor
    document.getElementById("component-status").innerHTML = "State: " + g_opc_da_data.level1Low;
  }
  else if(component_no.indexOf("LL2") == 0){ // this is a proximity sensor
    document.getElementById("component-status").innerHTML = "State: " + g_opc_da_data.level2Low;
  }
  else if(component_no.indexOf("LL3") == 0){ // this is a proximity sensor
    document.getElementById("component-status").innerHTML = "State: " + g_opc_da_data.level3Low;
  }
  else{
    document.getElementById("component-status").innerHTML = "none.";
  }
}

// evaluates the read response sent by the OPC XML DA server
var opc_status_counter = 0;
var getDataFromReadResponse = function (response) {
  g_opc_da_status = true;
  console.log("getDataFromReadResponse success");
  var retItems = response.getElementsByTagName('Items');
  g_opc_da_data.level1 = retItems[0].firstChild.firstChild.nodeValue;
  g_opc_da_data.level2 = retItems[1].firstChild.firstChild.nodeValue;
  g_opc_da_data.level3 = retItems[2].firstChild.firstChild.nodeValue;
  g_opc_da_data.level1High = retItems[3].firstChild.firstChild.nodeValue;
  g_opc_da_data.level2High = retItems[4].firstChild.firstChild.nodeValue;
  g_opc_da_data.level3High = retItems[5].firstChild.firstChild.nodeValue;
  g_opc_da_data.level1Low = retItems[6].firstChild.firstChild.nodeValue;
  g_opc_da_data.level2Low = retItems[7].firstChild.firstChild.nodeValue;
  g_opc_da_data.level3Low = retItems[8].firstChild.firstChild.nodeValue;
  updateComponentStatus(g_current_displayed_component_no);
  // toggle the status light
  if(opc_status_counter == 1){
    opcStatusImgSetGreen();
    opc_status_counter = 0;
  }
  else{
    opcStatusImgSetGrey();
    opc_status_counter++;
  }
};

function opcStatusImgSetRed(){
  document.querySelector("#opc-status-image").src = g_app_root + "img/red_light.png";
}
function opcStatusImgSetGreen(){
  document.querySelector("#opc-status-image").src = g_app_root + "img/green_light.png";
}
function opcStatusImgSetGrey(){
  document.querySelector("#opc-status-image").src = g_app_root + "img/grey_light.png";
}


function onSetServerClick(){
  g_opc_da_server_url = document.querySelector("#opc-server-url-input").value;
  ons.notification.alert("Server address saved.");
}