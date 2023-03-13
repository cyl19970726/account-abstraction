pragma circom 2.0.0;

include "./circomlib/circuits/poseidon.circom";

template Hash2Nodes() {
    signal input nonce;
    signal input secret;
    signal output hash;

    component poseidon = Poseidon(2);
    poseidon.inputs[0] <== nonce;
    poseidon.inputs[1] <== secret;
    hash <== poseidon.out;
}

component main {public[nonce]} = Hash2Nodes();