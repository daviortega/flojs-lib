'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
const bufferutils_1 = require('./bufferutils'); // ,BufferWriter reverseBuffer
const transaction_1 = require('./transaction');
// import { flo } from './networks'
const varuint = require('varuint-bitcoin');
// The maximum floData that fits in one transaction
exports.FLODATA_MAX_LEN = 1040;
// const EMPTY_SCRIPT = Buffer.alloc(0)
// const ZERO = Buffer.from('0000000000000000000000000000000000000000000000000000000000000000', 'hex')
// const ONE = Buffer.from('0000000000000000000000000000000000000000000000000000000000000001', 'hex')
// const VALUE_UINT64_MAX = Buffer.from('ffffffffffffffff', 'hex')
// const BLANK_OUTPUT = {
//  script: EMPTY_SCRIPT,
//  valueBuffer: VALUE_UINT64_MAX
// }
const EMPTY_WITNESS = [];
class FLOTransaction extends transaction_1.Transaction {
  constructor() {
    super();
    this.version = 2;
    this._floData = Buffer.from([]);
  }
  set floData(floData) {
    this.setFloData(floData);
  }
  get floData() {
    return this._floData;
  }
  static fromBuffer(buffer, _NO_STRICT) {
    const bufferReader = new bufferutils_1.BufferReader(buffer);
    const tx = new FLOTransaction();
    tx.version = bufferReader.readInt32();
    const marker = bufferReader.readUInt8();
    const flag = bufferReader.readUInt8();
    let hasWitnesses = false;
    if (
      marker === transaction_1.Transaction.ADVANCED_TRANSACTION_MARKER &&
      flag === transaction_1.Transaction.ADVANCED_TRANSACTION_FLAG
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
    if (tx.version >= 2) {
      tx.floData = bufferReader.readVarSlice();
    }
    if (_NO_STRICT) return tx;
    if (bufferReader.offset !== buffer.length) {
      throw new Error(
        `Transaction has unexpected data. Offset ${bufferReader.offset}::${
          buffer.length
        }`,
      );
    }
    return tx;
  }
  static fromHex(hex) {
    return FLOTransaction.fromBuffer(Buffer.from(hex, 'hex'));
  }
  toBuffer(buffer, initialOffset) {
    return this.__flo_toBuffer(buffer, initialOffset, true);
  }
  toHex() {
    return this.__flo_toBuffer(undefined, undefined).toString('hex');
  }
  __flo_toBuffer(
    buffer,
    initialOffset,
    _ALLOW_WITNESS = false,
    options = { excludeFloData: false },
  ) {
    if (!buffer) {
      buffer = Buffer.allocUnsafe(
        this._flo_byteLength(_ALLOW_WITNESS, options),
      );
    }
    transaction_1.Transaction.prototype.toBuffer.call(
      this,
      buffer,
      initialOffset,
    );
    if ((options && options.excludeFloData) || this.version < 2) {
      return buffer;
    }
    let offset =
      this._flo_byteLength(_ALLOW_WITNESS, options) -
      (this.floData.length + varuint.encode(this.floData.length).length);
    varuint.encode(this.floData.length, buffer, offset);
    offset += varuint.encode.bytes;
    // Append the floData itself
    this.floData.copy(buffer, offset);
    // Return the built transaciton Buffer
    return buffer;
  }
  setFloData(floData) {
    const tmpFloData = Buffer.from(floData);
    if (tmpFloData.length > exports.FLODATA_MAX_LEN) {
      throw new Error(
        `Attempted to set too much floData! Maximum is ${
          exports.FLODATA_MAX_LEN
        }, you tried ${tmpFloData.length}!`,
      );
    }
    this._floData = tmpFloData;
    return this;
  }
  _flo_byteLength(__allowWitness, options) {
    let byteLength = transaction_1.Transaction.prototype.byteLength.call(
      this,
      __allowWitness,
    );
    if ((options && options.excludeFloData) || this.version < 2) {
      return byteLength;
    }
    let floDataVarInt = varuint.encode(this.floData.length);
    return byteLength + floDataVarInt.length + this.floData.length;
  }
}
exports.FLOTransaction = FLOTransaction;
