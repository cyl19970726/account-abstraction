// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.12;

/* solhint-disable avoid-low-level-calls */
/* solhint-disable no-inline-assembly */
/* solhint-disable reason-string */

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "../SimpleAccount.sol";
import "./verifier.sol";
import "../../interfaces/UserOperation.sol";

struct Proof {
    uint256[2] a;
    uint256[2][2] b;
    uint256[2] c;
}

contract SecretAccount is SimpleAccount{
    using ECDSA for bytes32;
    using UserOperationLib for *;
    Verifier public verifier;

    mapping(uint256=>uint256) public nonceToHash;


    constructor(IEntryPoint anEntryPoint)SimpleAccount(anEntryPoint) {
        verifier = new Verifier();
    }

    function _validateAndUpdateNonce(UserOperation calldata userOp) internal virtual override {
        require(_validateSignature(userOp,userOp.hash()) ==0 ,"failed to verify signature or secret");
        super._validateAndUpdateNonce(userOp);
    }  

    /// implement template method of BaseAccount
    function _validateSignature(UserOperation calldata userOp, bytes32 userOpHash)
    internal override virtual returns (uint256 validationData) {
        (bytes memory signature,Proof memory proof) =  abi.decode(userOp.signature,(bytes,Proof));
        bytes32 hash = userOpHash.toEthSignedMessageHash();
        if (owner != hash.recover(signature))
            return SIG_VALIDATION_FAILED;
        
        // verify secret 
        uint256 currentNonce = nonce();
        uint256 secretHash = nonceToHash[currentNonce];
        if (secretHash != 0){
            if (!verifier.verifyProof(proof.a,proof.b,proof.c,[secretHash,currentNonce])){
                return SIG_VALIDATION_FAILED;
            }
        }
        return 0;
    } 

     function verifyProof(
         uint[2] memory a,
        uint[2][2] memory b,
        uint[2] memory c,
        uint[2] memory input
    ) public view returns(bool){
        return _verifyProof(a,b,c,input);
    }

    function _verifyProof(
         uint[2] memory a,
        uint[2][2] memory b,
        uint[2] memory c,
        uint[2] memory input
    ) internal view returns(bool){
        return verifier.verifyProof(a,b,c,input);
    }

    function setSecret(uint256 furtureNonce, uint256 secertHash ) public {
        if (furtureNonce < nonce()){
            revert("lock-nonce too low");
        }
        nonceToHash[furtureNonce] = secertHash;
    }



}