$(document).ready(function() {
    var storedHost = localStorage.getItem('host');
    if (storedHost) {
        var url = new URL(storedHost);
        $('#ip').val(url.hostname);
        $('#port').val(url.port);
    }
});

$('#Form').submit(function(event) {
    event.preventDefault();
    var ip = $('#ip').val();
    var port = $('#port').val();
    var newHost = "http://" + ip + ":" + port;
    localStorage.setItem('host', newHost);
    window.location.href = "/";
});