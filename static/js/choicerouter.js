function getconfig() {
    $.get(host + '/systemapi/getconfig', function(data) {
        dev = data.dev;
        var table = document.querySelector("table");
        var tbody = document.getElementById("router-list");

        function processRouterName(i) {
            $.get(host + '/routerapi/' + i + '/api/xqsystem/router_name', function(data) {
                
                var routername = data.routerName;
                if (routernum == i) {
                    routername = routername + "（当前选择）";
                }
                var tr = document.createElement("tr");

                var td_routername = document.createElement("td");
                var detail_url = "./?choice=" + i;

                td_routername.innerHTML = "<a href='" + detail_url + "'>" + routername + "</a>";
                tr.appendChild(td_routername);

                var td_ip = document.createElement("td");
                td_ip.textContent = dev[i].ip;
                tr.appendChild(td_ip);

                tbody.appendChild(tr);

                // 如果已经获取了所有的routername，将tbody添加到table
                if (i === dev.length - 1) {
                    table.appendChild(tbody);
                }
            }).fail(function(jqXHR, textStatus, errorThrown) { // 添加HTTP错误处理
                mdui.snackbar({
                    message: "请求失败：HTTP " + jqXHR.status + " - " + errorThrown
                });
            });
        }

        // 循环获取routername
        for (var i = 0; i < dev.length; i++) {
            processRouterName(i);
        }
    }).fail(function(jqXHR, textStatus, errorThrown) { // 添加HTTP错误处理
        mdui.snackbar({
            message: "请求失败：HTTP " + jqXHR.status + " - " + errorThrown
        });
    });
}

$(document).ready(function() {
    // 获取完整的URL
    var url = window.location.href;
    var params = new URLSearchParams(url.split('?')[1]);
    var choice = params.get('choice');
    if (choice) {
        localStorage.setItem("routernum", choice);
        window.location.href = "/web/";
    }

    var routernum = localStorage.getItem("routernum");

    getconfig();
});