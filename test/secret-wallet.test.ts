import { Contract,ContractFactory, Wallet,BigNumberish } from 'ethers'
import { ethers } from 'hardhat'
import { expect } from 'chai'
const snarkjs = require("snarkjs");
const fs = require("fs");
const circomlibjs = require("circomlibjs");
// import { poseidonContract, buildPoseidon } from "circomlibjs";

import {
  SecretAccount,
  SecretAccount__factory,
  TestUtil,
  TestUtil__factory
} from '../typechain'
import {
  createAddress,
  createAccountOwner,
  getBalance,
  isDeployed,
  ONE_ETH,
  createAccount, HashZero
} from './testutils'
import { fillUserOpDefaults, getUserOpHash, packUserOp, signUserOp } from './UserOp'
import { parseEther } from 'ethers/lib/utils'
import { UserOperation } from './UserOperation'

interface Proof {
    a: [BigNumberish, BigNumberish];
    b: [[BigNumberish, BigNumberish], [BigNumberish, BigNumberish]];
    c: [BigNumberish, BigNumberish];
}

interface InputSignals {
    signals : [BigNumberish,BigNumberish];
}
async function prove(witness: any): Promise<[Proof,InputSignals]> {
    // const wasmPath = "./circuits/secret_js/sercet.wasm";
    // const zkeyPath = "./circuits/circuit_final.zkey";

    // console.log(wasmPath)

    const result = await snarkjs.groth16.fullProve(witness,"./circuits/secret_js/secret.wasm", "./circuits/circuit_final.zkey");

    const inputs = result.publicSignals
    const proof = result.proof
    const solProof: Proof = {
        a: [proof.pi_a[0], proof.pi_a[1]],
        b: [
            [proof.pi_b[0][1], proof.pi_b[0][0]],
            [proof.pi_b[1][1], proof.pi_b[1][0]],
        ],
        c: [proof.pi_c[0], proof.pi_c[1]],
    };

    const signals : InputSignals = {
        signals: [inputs[0],inputs[1]],
    }

    return [solProof,signals];
}

function getPoseidonFactory(nInputs: number) {
    const bytecode = circomlibjs.poseidonContract.createCode(nInputs);
    const abiJson = circomlibjs.poseidonContract.generateABI(nInputs);
    const abi = new ethers.utils.Interface(abiJson);
    return new ContractFactory(abi, bytecode);
}


describe('SimpleAccount', function () {
  const entryPoint = '0x'.padEnd(42, '2')
  let accountOwner: Wallet
  const ethersSigner = ethers.provider.getSigner()
    
  let poseidon: any;
  let poseidonContract: Contract;

  before(async function () {
    poseidon = await circomlibjs.buildPoseidon();
    poseidonContract = await getPoseidonFactory(2).connect(ethersSigner).deploy();
  })

  it("generates same poseidon hash", async function () {
    const res = await poseidonContract["poseidon(uint256[2])"]([3, 101]);
    const res2 = poseidon([3, 101]);

    console.log(res.toString())
    expect(res.toString()).to.eql( poseidon.F.toString(res2));
}).timeout(500000);


  it('check proof off-chain', async()=>{
    const { proof, publicSignals } = await snarkjs.groth16.fullProve({nonce: 3, secret: 101}, "./circuits/secret_js/secret.wasm", "./circuits/circuit_final.zkey");

    console.log("Proof: ");
    console.log(JSON.stringify(proof, null, 1));

    const vKey = JSON.parse(fs.readFileSync("./circuits/verification_key.json"));

    // console.log(JSON.stringify(publicSignals))
    const res = await snarkjs.groth16.verify(vKey, publicSignals, proof);

    if (res === true) {
        console.log("Verification OK");
    } else {
        console.log("Invalid proof");
    }

  })

  it('check proof on chain', async()=>{

    let saf = await ethers.getContractFactory("SecretAccount");
    let safInstance = await saf.deploy("0x0000000000000000000000000000000001100001");
    await safInstance.deployed();

    const nonce = 3;
    const secret = 101;
    const witness = {
        // public 
        nonce,
        //private
        secret
    };

    const [solProof,inputs] = await prove(witness);

    console.log("Proof: ");
    console.log(JSON.stringify(solProof, null, 1));

    console.log("Inputs: ");
    console.log(JSON.stringify(inputs));

    await safInstance.verifyProof(solProof.a,solProof.b,solProof.c, inputs.signals);

  })

})
