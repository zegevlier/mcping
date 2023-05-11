export class Packet {
    buffer: number[] = [];

    // These are needed for VarInt encoding, https://wiki.vg/Protocol#VarInt_and_VarLong
    static SEGMENT_BITS = 0x7f;
    static CONTINUE_BIT = 0x80;

    setBuffer(buffer: number[]): void {
        this.buffer = [];
        this.buffer = [...buffer];
    }

    length(): number {
        return this.buffer.length;
    }

    toBytes(packetId: number): number[] {
        let packetIDPacket = new Packet();
        packetIDPacket.writeVarInt(packetId);
        packetIDPacket.writeBytes(this.buffer);
        let lengthPacket = new Packet();
        lengthPacket.writeVarInt(packetIDPacket.buffer.length);
        lengthPacket.writeBytes(packetIDPacket.buffer);
        return lengthPacket.buffer;
    }

    writeByte(value: number): void {
        this.writeBytes([value]);
    }

    writeBytes(value: number[]): void {
        this.buffer.push(...value);
    }

    readByte(): number {
        let r = this.buffer.shift();
        if (r === undefined) {
            throw new Error('Runtime Error: Cannot read empty buffer.');
        }
        return r;
    }

    readBytes(amount: number): number[] {
        return this.buffer.splice(0, amount);
    }

    writeVarInt(input: number): void {
        let value = input;
        while (true) {
            if ((value & ~Packet.SEGMENT_BITS) === 0) {
                this.writeByte(value);
                return;
            }
            this.writeByte((value & Packet.SEGMENT_BITS) | Packet.CONTINUE_BIT);
            value >>>= 7;
        }
    }

    readVarInt(): number {
        let value = 0;
        let position = 0;
        let currentByte;

        while (true) {
            currentByte = this.readByte();
            value |= (currentByte & Packet.SEGMENT_BITS) << position;

            if ((currentByte & Packet.CONTINUE_BIT) === 0) {
                break;
            }

            position += 7;

            if (position >= 32) {
                throw new Error('VarInt too big :(');
            }
        }

        return value;
    }

    readUnsignedShort(): number {
        const bytes = this.readBytes(2);
        return (bytes[0] << 8) | bytes[1];
    }

    writeUnsignedShort(value: number): void {
        this.writeBytes([(value & 0xff00) >> 8, (value & 0x00ff) >> 0]);
    }

    readString(): string {
        const l = this.readVarInt();
        let dec = new TextDecoder();
        let str = dec.decode(new Uint8Array(this.readBytes(l)));
        return str;
    }

    writeString(value: string): void {
        const length = value.length;
        let enc = new TextEncoder();
        this.writeVarInt(length);
        this.writeBytes([...enc.encode(value)]);
    }
}