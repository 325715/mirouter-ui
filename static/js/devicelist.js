showtype = false

function updateStatus() {
    $.get(host + '/routerapi/' + routernum + '/api/misystem/devicelist', function(data) {
        listDevices(data.list)
    }).fail(function(data) {
        mdui.snackbar({
            message: "请求失败：" + data.msg
        })
    })
}


function listDevices(dev) {
    // 按下载速度或上传速度排序设备列表
    dev.sort(
        function(a, b) {
            if (showtype == true) {
                // 按上传速度排序
                return b.statistics.upspeed - a.statistics.upspeed;
            } else {
                // 按下载速度排序
                return b.statistics.downspeed - a.statistics.downspeed;

            }
        });

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
        td_devname.innerHTML = "<a href='" + detail_url + "'>" + device.name + "</a>";
        tr.appendChild(td_devname);

        var td_downspeed = document.createElement("td");
        td_downspeed.textContent = convertSpeed(device.statistics.downspeed);
        tr.appendChild(td_downspeed);

        var td_upspeed = document.createElement("td");
        td_upspeed.textContent = convertSpeed(device.statistics.upspeed);
        tr.appendChild(td_upspeed);

        var td_onlinetime = document.createElement("td");
        td_onlinetime.textContent = convertSeconds(device.ip[0].online);
        tr.appendChild(td_onlinetime);

        var td_type = document.createElement("td");
        td_type.textContent = getConnectType(device.type);
        tr.appendChild(td_type);

        ips = moreipdisplay(device.ip)
        var td_ip = document.createElement("td");
        td_ip.textContent = ips
        tr.appendChild(td_ip);

        var td_mac = document.createElement("td");
        td_mac.textContent = device.mac;
        tr.appendChild(td_mac);

        //将内容行添加到表格内容区域中
        tbody.appendChild(tr);
    }

    //更新表格元素
    table.appendChild(tbody);
    $('#devicenum_now').text(dev.length);
    if (dev.length >= 10) {
        $('#warning').show();
    } else {
        $('#warning').hide();
    }
}

$('#switchdownspeed').click(function() {
    showtype = false;
    // $('#showtypetext').text('下载速度');
});
$('#switchupspeed').click(function() {
    showtype = true;
    // $('#showtypetext').text('上传速度');
})

$(function() {
    // 初次加载状态
    updateStatus();
    // 每5秒刷新状态
    setInterval(function() {
        updateStatus();
    }, pageUpdateTime);
});