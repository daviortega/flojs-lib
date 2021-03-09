import { BufferReader } from './bufferutils'; // ,BufferWriter reverseBuffer
import { Transaction } from './transaction'
// import { flo } from './networks'

const varuint = require('varuint-bitcoin');

// The maximum floData that fits in one transaction
export const FLODATA_MAX_LEN = 1040

// const EMPTY_SCRIPT = Buffer.alloc(0)
// const ZERO = Buffer.from('0000000000000000000000000000000000000000000000000000000000000000', 'hex')
// const ONE = Buffer.from('0000000000000000000000000000000000000000000000000000000000000001', 'hex')
// const VALUE_UINT64_MAX = Buffer.from('ffffffffffffffff', 'hex')
// const BLANK_OUTPUT = {
//  script: EMPTY_SCRIPT,
//  valueBuffer: VALUE_UINT64_MAX
// }
const EMPTY_WITNESS: Buffer[] = [];

class FLOTransaction extends Transaction {
    private _floData: Buffer

    constructor() {
        super()
        this.version = 2
        this._floData = Buffer.from([])
    }

    set floData(floData: Buffer) {
        this.setFloData(floData)
    }

    get floData(): Buffer {
        return this._floData
    }

    static fromBuffer(buffer: Buffer, _NO_STRICT?: boolean) {
        const bufferReader = new BufferReader(buffer);

        const tx = new FLOTransaction();
        tx.version = bufferReader.readInt32();
    
        const marker = bufferReader.readUInt8();
        const flag = bufferReader.readUInt8();
    
        let hasWitnesses = false;
        if (
          marker === Transaction.ADVANCED_TRANSACTION_MARKER &&
          flag === Transaction.ADVANCED_TRANSACTION_FLAG
        ) {
          hasWitnesses = true;
        } else {
          bufferReader.offset -= 2;
        }
    
        const vinLen = bufferReader.readVarInt();
        for (let i = 0; i < vinLen; ++i) {
          tx.ins.push({
            hash: bufferReader.readSlice(32),
            index: bufferReader.readUInt32(),
            script: bufferReader.readVarSlice(),
            sequence: bufferReader.readUInt32(),
            witness: EMPTY_WITNESS,
          });
        }
    
        const voutLen = bufferReader.readVarInt();
        for (let i = 0; i < voutLen; ++i) {
          tx.outs.push({
            value: bufferReader.readUInt64(),
            script: bufferReader.readVarSlice(),
          });
        }
    
        if (hasWitnesses) {
          for (let i = 0; i < vinLen; ++i) {
            tx.ins[i].witness = bufferReader.readVector();
          }
    
          // was this pointless?
          if (!tx.hasWitnesses())
            throw new Error('Transaction has superfluous witness data');
        }
    
        tx.locktime = bufferReader.readUInt32();
        if (tx.version >= 2 && bufferReader.offset !== buffer.length) { 
            tx.floData = bufferReader.readVarSlice() 
        }
    
        if (_NO_STRICT) return tx;
        if (bufferReader.offset !== buffer.length) {
            throw new Error(`Transaction has unexpected data. Offset ${bufferReader.offset}::${buffer.length}`);
        }

        return tx;
    }

    static fromHex(hex: string): FLOTransaction {
        return FLOTransaction.fromBuffer(Buffer.from(hex, 'hex'))
    }
    
    public toBuffer(buffer?: Buffer, initialOffset?: number): Buffer {
        return this.__flo_toBuffer(buffer, initialOffset, true);
    }

    public toHex(): string {
        return this.__flo_toBuffer(undefined, undefined).toString('hex');
    }

    private __flo_toBuffer(
        buffer?: Buffer,
        initialOffset?: number,
        _ALLOW_WITNESS: boolean = false,
        options: {excludeFloData: boolean} = {excludeFloData: false}
    ): Buffer {
        if (!buffer) {
            buffer = Buffer.allocUnsafe(this._flo_byteLength(_ALLOW_WITNESS, options)) as Buffer;
        }

        Transaction.prototype.toBuffer.call(this, buffer, initialOffset)
        if ((options && options.excludeFloData) || this.version < 2) { return buffer }

        let offset = this._flo_byteLength(_ALLOW_WITNESS, options) - (this.floData.length + varuint.encode(this.floData.length).length)
        varuint.encode(this.floData.length, buffer, offset)
        offset += varuint.encode.bytes
        // Append the floData itself
        this.floData.copy(buffer, offset)

        // Return the built transaciton Buffer
        return buffer
    }

    private setFloData(floData: Buffer): this {
        const tmpFloData = Buffer.from(floData)
        if (tmpFloData.length > FLODATA_MAX_LEN) { 
            throw new Error(`Attempted to set too much floData! Maximum is ${FLODATA_MAX_LEN}, you tried ${tmpFloData.length}!`) 
        }
        this._floData = tmpFloData
        return this
    }

    private _flo_byteLength (__allowWitness: boolean, options: { excludeFloData: boolean; }) {
        let byteLength = Transaction.prototype.byteLength.call(this, __allowWitness)
    
        if ((options && options.excludeFloData) || this.version < 2) { return byteLength }
    
        let floDataVarInt = varuint.encode(this.floData.length)
    
        return (byteLength + floDataVarInt.length + this.floData.length)
      }

}

export {
    FLOTransaction
}