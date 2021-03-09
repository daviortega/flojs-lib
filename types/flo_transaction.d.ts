import { Transaction } from './transaction';
export declare const FLODATA_MAX_LEN = 1040;
declare class FLOTransaction extends Transaction {
    private _floData;
    constructor();
    floData: Buffer;
    static fromBuffer(buffer: Buffer, _NO_STRICT?: boolean): FLOTransaction;
    static fromHex(hex: string): FLOTransaction;
    toBuffer(buffer?: Buffer, initialOffset?: number): Buffer;
    toHex(): string;
    private __flo_toBuffer;
    private setFloData;
    private _flo_byteLength;
}
export { FLOTransaction };
