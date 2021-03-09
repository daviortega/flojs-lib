import * as assert from 'assert';
import { describe, it } from 'mocha';
import { FLOTransaction } from '..';
// import * as bscript from '../src/script';
import * as fixtures from './fixtures/flo_transaction.json';

describe('FLOTransaction', () => {
  /*function fromRaw(raw: any, noWitness?: boolean): Transaction {
    const tx = new Transaction();
    tx.version = raw.version;
    tx.locktime = raw.locktime;

    raw.ins.forEach((txIn: any, i: number) => {
      const txHash = Buffer.from(txIn.hash, 'hex');
      let scriptSig;

      if (txIn.data) {
        scriptSig = Buffer.from(txIn.data, 'hex');
      } else if (txIn.script) {
        scriptSig = bscript.fromASM(txIn.script);
      }

      tx.addInput(txHash, txIn.index, txIn.sequence, scriptSig);

      if (!noWitness && txIn.witness) {
        const witness = txIn.witness.map((x: string) => {
          return Buffer.from(x, 'hex');
        });

        tx.setWitness(i, witness);
      }
    });

    raw.outs.forEach((txOut: any) => {
      let script: Buffer;

      if (txOut.data) {
        script = Buffer.from(txOut.data, 'hex');
      } else if (txOut.script) {
        script = bscript.fromASM(txOut.script);
      }

      tx.addOutput(script!, txOut.value);
    });

    return tx;
  }*/
  describe('fromBuffer/fromHex', () => {
    function importExport(f: any): void {
      const id = f.id || f.hash;
      const txHex = f.hex || f.txHex;

      it('imports ' + f.description + ' (' + id + ')', () => {
        const actual = FLOTransaction.fromHex(txHex);

        assert.strictEqual(actual.toHex(), txHex);
      });

      if (f.whex) {
        it('imports ' + f.description + ' (' + id + ') as witness', () => {
          const actual = FLOTransaction.fromHex(f.whex);

          assert.strictEqual(actual.toHex(), f.whex);
        });
      }
    }

    fixtures.valid.forEach(importExport);
    fixtures.hashForSignature.forEach(importExport);
    fixtures.hashForWitnessV0.forEach(importExport);

    fixtures.invalid.fromBuffer.forEach(f => {
      it('throws on ' + f.exception, () => {
        assert.throws(() => {
          FLOTransaction.fromHex(f.hex);
        }, new RegExp(f.exception));
      });
    });

    it('.version should be interpreted as an int32le', () => {
      const txHex = 'ffffffff0000ffffffff';
      const tx = FLOTransaction.fromHex(txHex);
      assert.strictEqual(-1, tx.version);
      assert.strictEqual(0xffffffff, tx.locktime);
    });
  });
});
