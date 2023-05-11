// This errors for now, and doesn't work in local dev. Hopefully that gets better soon! :D
// Works great in production though!
import { connect } from 'cloudflare:sockets';
import { Packet } from "./packet";

interface Env { }

export const onRequest: PagesFunction<Env> = async (context) => {
    try {
        const url = new URL(context.request.url);

        let ip = url.searchParams.get("ip");
        if (ip === null) {
            return new Response("Missing ip parameter", { status: 400 });
        }

        // Server address that is sent to the server during the handshake.
        // This is different from the ip, because on SRV records it uses the SRV record itself instead of its target.
        let serverAddress = ip;

        // If no port is specified, see if there is a SRV record. If not, use the default port.
        if (ip.split(":").length == 1) {
            console.log("No port specified, looking for SRV record");
            // First, we check if there is a SRV record for the domain
            // Since this is going to run on workers, might as well use Cloudflare's DNS
            let doHResponse = await fetch("https://cloudflare-dns.com/dns-query?type=SRV&name=_minecraft._tcp." + ip, {
                headers: {
                    "Accept": "application/dns-json"
                }
            });

            // This type only includes the data we need.
            let doHResponseJSON: {
                Status: number,
                Answer?: {
                    data: string
                }[]
            } = await doHResponse.json();

            if (doHResponseJSON.Status == 0 && doHResponseJSON.Answer && doHResponseJSON.Answer.length > 0 && doHResponseJSON.Answer[0].data.split(" ").length == 4) {
                // If there is an SRV record, we use the first one
                console.log("Found SRV record, using it");
                let data_split = doHResponseJSON.Answer[0].data.split(" ");
                ip = data_split[3] + ":" + data_split[2];
            } else {
                // If there isn't, we use the default port
                ip += ":25565";
            }
        } else {
            // If a port is specified, we use that
            // The port is not included in the server address
            serverAddress = ip.split(":")[0];
        }

        console.log("Trying to ping", ip);

        const socket = connect(ip);
        const writer = socket.writable.getWriter()

        let handshake_packet = new Packet();
        handshake_packet.writeVarInt(760);
        handshake_packet.writeString(serverAddress);
        handshake_packet.writeUnsignedShort(25565);
        handshake_packet.writeVarInt(1);
        await writer.write(new Uint8Array(handshake_packet.toBytes(0x00)));

        // The status request packet is empty
        let status_packet = new Packet();
        await writer.write(new Uint8Array(status_packet.toBytes(0x00)));

        const reader = socket.readable.getReader();
        // We use this arr to store the bytes we read from the socket
        // We can't just store it in the packet directly, because we read the length of the packet
        let arr: number[] = [];

        while (true) {
            const res = await reader.read();

            // Minecraft doesn't always close the connection here for some reason
            // We can read the total length of the packet, and stop if we've read that much
            if (res.done) {
                console.log("Stream done, socket connection has been closed.");
                break;
            }
            arr.push(...res.value);

            // A status packet is very likely to be larger than 5 bytes, and then we know we can always read a whole varint from it.
            if (arr.length > 5) {
                let packet = new Packet();
                packet.setBuffer(arr);
                let length = packet.readVarInt();
                console.log("Packet length:", length, "Buffer length:", arr.length);
                if (length <= packet.length()) {
                    console.log("Got full packet");
                    break;
                }
            }
        }

        let packet = new Packet();
        packet.setBuffer(arr);
        packet.readVarInt(); // length
        packet.readVarInt(); // packet id
        let json = packet.readString();
        return new Response(json, {
            headers: {
                "content-type": "application/json",
            },
        });
    } catch (error) {
        return new Response("Socket connection failed" + error, { status: 500 });
    }
}
