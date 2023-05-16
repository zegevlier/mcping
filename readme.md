# Minecraft server status page in Cloudflare Workers

This project pings a Minecraft server using the new outbound [TCP sockets in Cloudflare workers](https://blog.cloudflare.com/workers-tcp-socket-api-connect-databases/). It has a simple HTML page that shows the status on there (this is VERY susceptible to XXS, use with extreme caution). It also has an API route at `/status` with one `ip` paramater.

There is a demo of this running [here](https://mcping.pages.dev/).
