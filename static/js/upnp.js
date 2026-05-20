function updateStatus() {
    $.get(host + '/routerapi/' + routernum + '/api/xqsystem/upnp', function(data) {
        if (data.status == 0) {
            mdui.snackbar({
                message: 'UPNP已关闭'
            })
        } else if (data.status == 1) {
            listUpnpInfo(data.list)
        }
    }).fail(function(data) {
        mdui.snackbar({
            message: "请求失败：" + data.msg
        })
    })
}


function listUpnpInfo(list) {

    //获取已有的表格元素
    var table = document.querySelector("table");

    //获取表格内容区域
    var tbody = document.getElementById("upnp-list");

    //清空表格内容区域
    tbody.innerHTML = "";
    //遍历dev数组，创建表格内容行
    for (var i = 0; i < list.length; i++) {
        //获取当前设备对象
        var obj = list[i];

        //创建内容行
        var tr = document.createElement("tr");

        //创建内容单元格，并添加到内容行中
        var td_ip = document.createElement("td");
        td_ip.textContent = obj.ip;
        tr.appendChild(td_ip);

        var td_protocol = document.createElement("td");
        td_protocol.textContent = obj.protocol;
        tr.appendChild(td_protocol);

        var td_cport = document.createElement("td");
        td_cport.textContent = obj.cport;
        tr.appendChild(td_cport);

        var td_rport = document.createElement("td");
        td_rport.textContent = obj.rport;
        tr.appendChild(td_rport);

        var td_name = document.createElement("td");
        td_name.textContent = obj.name;
        tr.appendChild(td_name);
        //将内容行添加到表格内容区域中
        tbody.appendChild(tr);
    }
    document.getElementById("upnpnum").textContent = list.length
        //更新表格元素
    table.appendChild(tbody);
}


$(function() {
    // 初次加载状态
    updateStatus();
    // 每5秒刷新状态
    setInterval(function() {
        updateStatus();
    }, pageUpdateTime);
});