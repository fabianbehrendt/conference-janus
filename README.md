# README

# Install ****Janus WebRTC Server on Ubuntu 20.04****

## Install Dependencies From Package Manager

```bash
sudo apt install libmicrohttpd-dev libjansson-dev \
	libssl-dev libsofia-sip-ua-dev libglib2.0-dev \
	libopus-dev libogg-dev libcurl4-openssl-dev liblua5.3-dev \
	libconfig-dev pkg-config libtool automake \
	git python3 python3-pip make cmake ninja-build
```

## Install libnice

To install libnice, you need meson as a dependency. After installing meson, clone the libnice repo and install it:

```bash
pip3 install meson
git clone https://gitlab.freedesktop.org/libnice/libnice
cd libnice
meson --prefix=/usr build && ninja -C build && sudo ninja -C build install
```

## Install libsrtp v2.2.0

Check if there is already a version of libsrtp installed:

```bash
sudo apt list libsrtp*
```

If it is installed, remove it:

```bash
sudo apt remove --purge libsrtp*
```

Install v2.2.0 from GitHub:

```bash
wget https://github.com/cisco/libsrtp/archive/v2.2.0.tar.gz
tar xfv v2.2.0.tar.gz
cd libsrtp-2.2.0
./configure --prefix=/usr --enable-openssl
make shared_library && sudo make install
```

## Install **usrsctp (for DataChannel support)**

```bash
git clone https://github.com/sctplab/usrsctp
cd usrsctp
./bootstrap
./configure --prefix=/usr --disable-programs --disable-inet --disable-inet6
make && sudo make install
```

## Install **libwebsockets**

```bash
git clone https://libwebsockets.org/repo/libwebsockets
# Use following line, if libwebsockets.org is unreachable:
# git clone https://github.com/warmcat/libwebsockets.git
cd libwebsockets
# Install the stable version of libwebsockets
git checkout v3.2-stable
mkdir build
cd build
# See https://github.com/meetecho/janus-gateway/issues/732 re: LWS_MAX_SMP
# See https://github.com/meetecho/janus-gateway/issues/2476 re: LWS_WITHOUT_EXTENSIONS
cmake -DLWS_MAX_SMP=1 -DLWS_WITHOUT_EXTENSIONS=0 -DCMAKE_INSTALL_PREFIX:PATH=/usr -DCMAKE_C_FLAGS="-fpic" ..
make && sudo make install
```

## Compile and install Janus

```bash
git clone https://github.com/meetecho/janus-gateway.git
cd janus-gateway
# Switch to v1.0.4
git checkout -b janus-1-0-4 v1.0.4
sh autogen.sh
./configure --prefix=/opt/janus --enable-post-processing
make
sudo make install
sudo make configs
```

Start the server either as a background process as explained in the next section, or directly using the following command:

```bash
/opt/janus/bin/janus
```

## Create Systemd File

Create the systemd file for janus:

```bash
sudo nano /etc/systemd/system/janus.service
```

Copy this script into `janus.service`:

```bash
[Unit]
Description=Janus WebRTC Server
After=network.target

[Service]
User=root
Nice=1
Restart=on-abnormal
LimitNOFILE=65536
PIDFile=/tmp/janus.pid
ExecStart=/usr/bin/sudo /opt/janus/bin/janus

[Install]
WantedBy=multi-user.target
```

Reload the daemon service:

```bash
sudo systemctl daemon-reload
```

Start service:

```bash
sudo service janus start
```

Stop service:

```bash
sudo service janus stop
```

Check status of service:

```bash
sudo service janus status
```

## Set an Admin Key for Janus

For creating and listing private rooms, you should configure an `admin_key`. Open the configuration file for the Janus videoroom plugin:

```bash
sudo nano /opt/janus/etc/janus/janus.plugin.videoroom.jcfg
```

Change the `admin_key` configuration inside the `general` configuration block. Uncomment it and set this to the desired value.

After changing the `admin_key` value, always restart the Janus WebRTC server!

## Create Logrotate File

Edit the janus configuration file to determine the log location:

```bash
sudo nano /opt/janus/etc/janus/janus.jcfg
```

Search for `log_to_file` and set the desired log location, e.g. in the common log directory on ubuntu `/var/log/janus/janus.log` like so:

```bash
log_to_file = "/var/log/janus/janus.log"
```

Create the log folder:

```bash
sudo mkdir /var/log/janus
```

Create a the logrotate file:

```bash
sudo nano /etc/logrotate.d/janus
```

Copy this script into the logrotate file:

```bash
/var/log/janus/janus.log {
        daily
        missingok
        rotate 7
        compress
        delaycompress
        notifempty
}
```

The file `/var/log/janus/janus.log` should be created automatically when the Janus service started. If not, create the file:

```bash
sudo touch /var/log/janus/janus.log
```

# Install Conference App

Install npm via nvm:

```bash
wget -qO- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.2/install.sh | bash
source ~/.bashrc
nvm install --lts
nvm use --lts
```

Clone the GitHub repository:

```bash
git clone https://github.com/fabianbehrendt/conference-janus.git
cd conference-janus
```

Install the dependencies with npm for the website and the websocket server:

```bash
cd website
npm install
cd ../backend
npm install
cd ..
```

## Configure Conference App

In `website/.env` edit the following environment variables:

```bash
# url of the Janus WebRTC server 
NEXT_PUBLIC_JANUS_URL=wss://<your.domain.com>

# url of the Socket.IO websocket server (backend/server.js)
# → it is the same as the url of the conference app website, if you configure NGINX the same as above
NEXT_PUBLIC_SOCKET_URL=wss://<another.domain.com>

# path to the directory on the Janus WebRTC server to save recordings
NEXT_PUBLIC_RECORDING_DIR=/path/on/server/for/recordings/
```

After changing the `.env` file, always rebuild the conference app!

## Build Conference App

```bash
cd website
npm run build
```

## Start the Application in the Terminal

Start the websocket server on port 3000:

```bash
cd backend
PORT=3000 npm start
```

Start the conference app on port 5000:

```bash
cd website
PORT=5000 npm start
```

## Start as Background Process

Install the PM2 process manager:

```bash
npm install pm2 -g
```

Start the websocket server on port 3000:

```bash
cd backend
PORT=3000 pm2 start --name backend -- start
cd ..
```

Start the conference app on port 5000:

```bash
cd website
PORT=5000 pm2 start --name website -- start
```

More useful commands for PM2 (taken from [[4]](https://pm2.keymetrics.io/docs/usage/quick-start/)):

```bash
# Fork mode
pm2 start app.js --name my-api # Name process

# Cluster mode
pm2 start app.js -i 0        # Will start maximum processes with LB depending on available CPUs
pm2 start app.js -i max      # Same as above, but deprecated.
pm2 scale app +3             # Scales `app` up by 3 workers
pm2 scale app 2              # Scales `app` up or down to 2 workers total

# Listing

pm2 list               # Display all processes status
pm2 jlist              # Print process list in raw JSON
pm2 prettylist         # Print process list in beautified JSON

pm2 describe 0         # Display all information about a specific process

pm2 monit              # Monitor all processes

# Logs

pm2 logs [--raw]       # Display all processes logs in streaming
pm2 flush              # Empty all log files
pm2 reloadLogs         # Reload all logs

# Actions

pm2 stop all           # Stop all processes
pm2 restart all        # Restart all processes

pm2 reload all         # Will 0s downtime reload (for NETWORKED apps)

pm2 stop 0             # Stop specific process id
pm2 restart 0          # Restart specific process id

pm2 delete 0           # Will remove process from pm2 list
pm2 delete all         # Will remove all processes from pm2 list

# Misc

pm2 reset <process>    # Reset meta data (restarted time...)
pm2 updatePM2          # Update in memory pm2
pm2 ping               # Ensure pm2 daemon has been launched
pm2 sendSignal SIGUSR2 my-app # Send system signal to script
pm2 start app.js --no-daemon
pm2 start app.js --no-vizion
pm2 start app.js --no-autorestart
```

# Network Configuration with SSL

```bash
                 _______________________________
                |           server              |
                |_________           _________  |
                |         |  http/  |         | |
  https/wss     |  nginx  |   ws    |  janus  | |
------------->  |         | ------> |         | |
                |_________|         |_________| |
                |                               |
                |_______________________________|
```

## Janus HTTP Transport Configuration

Open the HTTP transport configuration file:

```bash
sudo nano /opt/janus/etc/janus/janus.transport.http.jcfg
```

Change the `ip` configuration inside the `general` configuration block. Uncomment it and set this to `127.0.0.1`.

Keep the `https` configuration default, i.e. `false`.

## **Janus Websocket Transport Configuration**

Open the websocket transport configuration file:

```bash
sudo nano /opt/janus/etc/janus/janus.transport.websockets.jcfg
```

Change the `ws_ip` configuration inside the `general` configuration block. Uncomment it and set this to `127.0.0.1`.

Keep the `wss` configuration default, i.e. `false`.

## Restart Janus

```bash
sudo service janus restart
```

## NGINX Reverse Proxy

If NGINX is not installed yet, install it:

```bash
sudo apt update
sudo apt install nginx
```

Create a configuration file to automatically redirect from http to https:

```bash
sudo nano /etc/nginx/sites-available/redirect-http-to-https
```

Insert the following configuration:

```bash
server {
        listen 80 default_server;
        listen [::]:80 default_server;
        server_name _;
        return 301 https://$host$request_uri;
}
```

Create a configuration file for the Janus WebRTC server:

```bash
sudo nano /etc/nginx/sites-available/janus
```

Insert the following configuration:

```bash
server {
    listen 443 ssl http2;
    server_name <your.domain.com>;  <-- Update this line

    ssl_certificate /your/cert/path.crt;  <-- Update this line
    ssl_certificate_key /your/key/path.key;  <-- Update this line

    location /janus {
            proxy_set_header Host $host;
            proxy_set_header Connection "";
            proxy_http_version 1.1;

            proxy_pass http://127.0.0.1:8088;
    }

    location / {
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "Upgrade";
            proxy_set_header Host $host;

            proxy_pass http://127.0.0.1:8188;
    }
}
```

Create a configuration file for the website where the conference app runs:

```bash
sudo nano /etc/nginx/sites-available/conference-app
```

Insert the following configuration:

```bash
server {
    listen 443 ssl http2;
    server_name <another.domain.com>;  <-- Update this line

    ssl_certificate /your/cert/path.crt;  <-- Update this line
    ssl_certificate_key /your/key/path.key;  <-- Update this line

    location /socket {
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;

        proxy_pass http://127.0.0.1:3000;
    }

    location / {
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;

        proxy_pass http://127.0.0.1:5000;
        alias /;
    }
}
```

Create links to enable the configuration and restart NGINX:

```bash
sudo ln -s /etc/nginx/sites-available/redirect-http-to-https /etc/nginx/sites-enabled/
sudo ln -s /etc/nginx/sites-available/janus /etc/nginx/sites-enabled/
sudo ln -s /etc/nginx/sites-available/conference-app /etc/nginx/sites-enabled/
sudo nginx -t
sudo service nginx restart
```

To check if the http endpoint is working, open this url in your browser to get janus server information:

```
https://<your.domain.com>/janus/info
```

To check if the websocket endpoint is working, open this url in your browser to get a `403` message:

```
https://<your.domain.com>
```

# Recordings

The two demo rooms that come with the default setup of the Janus WebRTC server do not provide the feature of recording various media channels of the participants. To enable it, simply create a new room. The recorded files can be found in the directory specified in the `NEXT_PUBLIC_RECORDING_DIR` environment variable.

The Janus WebRTC server provides a tool to process the previously recorded RTP frames and create a playable media file. It can be found in `/opt/janus/bin/janus-pp-rec` and can be used with this command:

```bash
/opt/janus/bin/janus-pp-rec /path/to/source.mjr /path/to/destination.[opus|ogg|mka|wav|webm|mkv|h264|srt]
```

# Using the Application

To create, delete and show the conference rooms, visit:

```bash
https://<another.domain.com>/create-conference
```

You can delete the two demo room entries. To do that, click on the trash icon and enter `adminpwd` as the host pin.

To create a room, enter the name of the room, the password required by the participants to join, and a host pin required to delete the room.

After submitting, you are redirected to a page which shows the details of the conference.

The first url should be shared with the participants of the conference, whereas the moderator of the conference should join using the button at the bottom.

The second url can be shared with other moderators, or simply saved for later. With this you can view this page again, so you will be able to join as a moderator.

# Sources

[0] [https://github.com/meetecho/janus-gateway](https://github.com/meetecho/janus-gateway)

[1] [https://facsiaginsa.com/janus/install-janus-webrtc-server-on-ubuntu](https://facsiaginsa.com/janus/install-janus-webrtc-server-on-ubuntu)

[2] [https://facsiaginsa.com/janus/basic-janus-configuration-with-ssl](https://facsiaginsa.com/janus/basic-janus-configuration-with-ssl)

[3] [https://github.com/nvm-sh/nvm](https://github.com/nvm-sh/nvm#install--update-script)

[4] [https://pm2.keymetrics.io/docs/usage/quick-start/](https://pm2.keymetrics.io/docs/usage/quick-start/)

[5] [https://janus.conf.meetecho.com/docs/janus-pp-rec_8c.html](https://janus.conf.meetecho.com/docs/janus-pp-rec_8c.html)

[6] [https://janus.conf.meetecho.com/docs/videoroom.html](https://janus.conf.meetecho.com/docs/videoroom.html)