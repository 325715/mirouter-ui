function updateStatus() {
    $.get(host + '/routerapi/' + routernum + '/api/misystem/status', function(data) {

        upspeed = convertSpeed(data.wan.upspeed)
        maxuploadspeed = convertSpeed(data.wan.maxuploadspeed)
        downspeed = convertSpeed(data.wan.downspeed)
        maxdownloadspeed = convertSpeed(data.wan.maxdownloadspeed)
        uploadtotal = convertbytes(data.wan.upload)
        downloadtotal = convertbytes(data.wan.download)
        cpuload = roundToOneDecimal(data.cpu.load * 100) + '%'
        memusage = roundToOneDecimal(data.mem.usage * 100) + '%'
        devicenum = data.count.all
        devicenum_now = data.count.online
        $('#platform').text("小米路由器" + data.hardware.platform);
        $('#cpu-used .mdui-progress-determinate').css('width', cpuload);
        $('#cpu-used-text').text(cpuload);
        $('#mem-used .mdui-progress-determinate').css('width', memusage);
        $('#mem-used-text').text(memusage);
        $('#uploadspeed').text(upspeed)
        $('#maxuploadspeed').text(maxuploadspeed)
        $('#downloadspeed').text(downspeed)
        $('#maxdownloadspeed').text(maxdownloadspeed)
        $('#uploadtotal').text(uploadtotal)
        $('#downloadtotal').text(downloadtotal)
        $("#devicenum").text(devicenum)
        $("#devicenum_now").text(devicenum_now)
        listDevices(data.dev)
    }).fail(function(data) {
        mdui.snackbar({
            message: "请求失败：" + data.msg
        })
    })
}

function get_router_name() {
    $.get(host + '/routerapi/' + routernum + '/api/xqsystem/router_name', function(data) {

        router_name = data.routerName
        $("#router_name").text(router_name)

    }).fail(function(data) {
        mdui.snackbar({
            message: "请求失败：" + data.msg
        })
    })
}

function check_internet_connect() {
    $.get(host + '/routerapi/' + routernum + '/api/xqsystem/internet_connect', function(data) {

        if (data.connect === 1) {
            mdui.snackbar({
                message: '路由器好像没联网呢😢'
            });

        }
    }).fail(function(data) {
        mdui.snackbar({
            message: "请求失败：" + data.msg
        })
    })
}
$(function() {
    // 初次加载状态
    updateStatus();
    check_internet_connect();
    get_router_name();
    // get_messages();

    // 每5秒刷新状态
    setInterval(function() {
        updateStatus();
    }, pageUpdateTime);
});



function listDevices(dev) {
    //获取已有的表格元素
    var table = document.querySelector("table");

    //获取表格内容区域
    var tbody = document.getElementById("device-list");

    //清空表格内容区域
    tbody.innerHTML = "";
    //遍历dev数组，创建表格内容行
    for (var i = 0; i < dev.length; i++) {
        //获取当前设备对象
        var device = dev[i];

        //创建内容行
        var tr = document.createElement("tr");

        //创建内容单元格，并添加到内容行中
        var td_devname = document.createElement("td");
        var detail_url = "/web/device/index.html?mac=" + device.mac;
        td_devname.innerHTML = "<a href='" + detail_url + "'>" + device.devname + "</a>";
        tr.appendChild(td_devname);

        var td_downspeed = document.createElement("td");
        td_downspeed.textContent = convertSpeed(device.downspeed);
        tr.appendChild(td_downspeed);

        var td_upspeed = document.createElement("td");
        td_upspeed.textContent = convertSpeed(device.upspeed);
        tr.appendChild(td_upspeed);

        var td_uptotal = document.createElement("td");
        td_uptotal.textContent = convertbytes(device.upload);
        tr.appendChild(td_uptotal);

        var td_downtotal = document.createElement("td");
        td_downtotal.textContent = convertbytes(device.download);
        tr.appendChild(td_downtotal);
        //将内容行添加到表格内容区域中
        tbody.appendChild(tr);
    }

    //更新表格元素
    table.appendChild(tbody);
}

function pushuptrafficdata(name, value) {
    data = {
        value: value,
        name: name
    }
    upload_traffic_data.push(data);

}

function pushdowntrafficdata(name, value) {
    data = {
        value: value,
        name: name
    }
    download_traffic_data.push(data);

}