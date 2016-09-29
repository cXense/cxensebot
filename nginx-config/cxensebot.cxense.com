# -*-nginx-*-
# This setup serves the CxenseBot server backend for Slack, web and physical robot.
server {
        listen 80 default_server;
        listen [::]:80 default_server;
        server_name cxensebot.cxense.com;
        return 301 https://$server_name$request_uri;
}
server {
    listen 443;
    ssl on;

    server_name cxensebot.cxense.com;
    ssl_certificate ; <-- TODO: Add your HTTPS certificate here!
    ssl_certificate_key ; <-- TODO: Add your HTTPS key here!

    access_log /var/log/nginx/cxensebot.cxense.com-access.log;
    error_log /var/log/nginx/cxensebit.cxense.com-error.log;

    location / {
        proxy_pass http://localhost:10520/;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    location /facebook/ {
        proxy_pass http://localhost:10521/facebook/;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
