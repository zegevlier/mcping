# Minecraft server status page in Cloudflare Workers

This project pings a Minecraft server using the new outbound [TCP sockets in Cloudflare workers](https://blog.cloudflare.com/not-yet-there). It has a simple HTML page that shows the status on there (this is VERY susceptible to XXS, use with extreme caution). It also has an API route at `/status` with one `ip` paramater.
