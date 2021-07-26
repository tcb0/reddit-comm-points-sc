pragma solidity ^0.8.0;

import "hardhat/console.sol";
import "./ISubredditPoints.sol";

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";

// ERC20 and borrows only operators notion from ERC777, accounts can revoke default operator
contract SubredditPoints_v0 is ISubredditPoints, Ownable, ERC20 {
    using SafeMath for uint256;
    using Address for address;

    event Sent(
        address indexed operator,
        address indexed from,
        address indexed to,
        uint256 amount,
        bytes data,
        bytes operatorData
    );

    event Minted(address indexed operator, address indexed to, uint256 amount, bytes data, bytes operatorData);

    event Burned(address indexed operator, address indexed from, uint256 amount, bytes data, bytes operatorData);

    event AuthorizedOperator(address indexed operator, address indexed tokenHolder);

    event RevokedOperator(address indexed operator, address indexed tokenHolder);

    event DefaultOperatorAdded(address indexed operator);

    event DefaultOperatorRemoved(address indexed operator);

    // ------------------------------------------------------------------------------------
    // VARIABLES BLOCK, MAKE SURE ONLY ADD TO THE END

    string private _subreddit;
    string private _name;
    string private _symbol;

    // operators notion from ERC777, accounts can revoke default operator
    mapping(address => bool) private _defaultOperators;

    // Maps operators and revoked default operators to state (enabled/disabled)
    mapping(address => mapping(address => bool)) private _operators;
    mapping(address => mapping(address => bool)) private _revokedDefaultOperators;

    // operators notion from ERC777, accounts can revoke default operator
    // This isn't ever read from - it's only used to respond to the defaultOperators query.
    address[] private _defaultOperatorsArray;

    address _distributionContract;

    address[] public _registeredAccounts;

    // END OF VARS
    // ------------------------------------------------------------------------------------

    constructor(
        address distributionContract_,
        string memory subreddit_,
        string memory name_,
        string memory symbol_,
        address[]  memory defaultOperators_
    ) ERC20(name_, symbol_) {

        require(bytes(subreddit_).length != 0, "SubredditPoints: subreddit can't be empty");

        updateDistributionContract(distributionContract_);

        _subreddit = subreddit_;

        _defaultOperatorsArray = defaultOperators_;
        for (uint256 i = 0; i < defaultOperators_.length; i++) {
            _defaultOperators[defaultOperators_[i]] = true;
            emit DefaultOperatorAdded(defaultOperators_[i]);
        }
    }


    // ------------------------------------------------------------------------------------
    // BATCH MINTING

    function batchMint(bytes calldata data) override external {
        require(_msgSender() == _distributionContract, "SubredditPoints: only distribution contract can mint points");

        bytes memory input = data;

        uint memPtr;
        assembly {
            memPtr := add(input, 0x20)
        }
        uint end = memPtr + input.length;
        uint byte0 = readUint(memPtr, 1);
        memPtr += 1;
        if (isRlpBatchType(byte0)) {
            batchTypeRlp(memPtr, end, byte0);
        } else if (isNativeBatchType(byte0)) {
            batchTypeNative(memPtr, end, byte0);
        } else if (isBitmapBatchType(byte0)) {
            batchTypeBitmap(data, byte0);
        }
    }

    function isRlpBatchType(uint byte0) private returns (bool) {
        return byte0 == 0 || byte0 == 2 || byte0 == 4 || byte0 == 6;
    }

    function isNativeBatchType(uint byte0) private returns (bool) {
        return byte0 == 1 || byte0 == 9 || byte0 == 43 || byte0 == 11 || byte0 == 35 || byte0 == 3 || byte0 == 29 || byte0 == 13 || byte0 == 21 || byte0 == 5 || byte0 == 63 || byte0 == 47 || byte0 == 31 || byte0 == 15 || byte0 == 55 || byte0 == 39 || byte0 == 23 || byte0 == 7;
    }

    function isBitmapBatchType(uint byte0) private returns (bool) {
        return byte0 == 255 || byte0 == 191 || byte0 == 223 || byte0 == 159 || byte0 == 239 || byte0 == 175 || byte0 == 207 || byte0 == 143 || byte0 == 247 || byte0 == 183 || byte0 == 215 || byte0 == 151 || byte0 == 231 || byte0 == 167 || byte0 == 199 || byte0 == 135;
    }


    // ------------------------------------------------------------------------------------
    // DECODING UTILS

    struct RawSlice {
        uint256 length;
        uint256 ptr;
    }

    uint8 constant STRING_SHORT_START = 0x80;
    uint8 constant STRING_LONG_START = 0xb8;
    uint8 constant LIST_SHORT_START = 0xc0;
    uint8 constant LIST_LONG_START = 0xf8;
    uint256 lastBatchedRecord = 0;

    function parseRLP(uint memPtr) private pure returns (RawSlice memory data, uint len) {
        uint byte0;
        assembly {
            byte0 := byte(0, mload(memPtr))
        }

        uint offset;
        uint data_len;
        if (byte0 < STRING_SHORT_START)
            (offset, data_len) = (0, 1);

        else if (byte0 < STRING_LONG_START)
            (offset, data_len) = (1, byte0 - STRING_SHORT_START);

        else if (byte0 < LIST_SHORT_START) {
            uint byteLen = byte0 - STRING_LONG_START;
            // # of bytes the actual length is
            offset = 1 + byteLen;

            /* 32 byte word size */
            assembly {
                data_len := div(mload(add(memPtr, 1)), exp(256, sub(32, byteLen))) // right shifting to get the len
            }
        }

        else if (byte0 < LIST_LONG_START) {
            (offset, data_len) = (1, byte0 - LIST_SHORT_START);
        }

        else {
            uint byteLen = byte0 - LIST_LONG_START;
            offset = 1 + byteLen;

            assembly {
                let dataLen := div(mload(add(memPtr, 1)), exp(256, sub(32, byteLen))) // right shifting to the correct length
            }
        }
        return (RawSlice(data_len, memPtr + offset), offset + data_len);
    }

    function readUint(uint ptr, uint len) private pure returns (uint) {
        uint result;
        assembly {
            result := mload(ptr)
            if lt(len, 32) {
                result := div(result, exp(256, sub(32, len)))
            }
        }
        return result;
    }

    function toUint8(bytes memory _bytes, uint256 _start) private pure returns (uint8) {
        require(_bytes.length >= _start + 1 , "toUint8_outOfBounds");
        uint8 tempUint;

        assembly {
            tempUint := mload(add(add(_bytes, 0x1), _start))
        }

        return tempUint;
    }

    function toUint16(bytes memory _bytes, uint256 _start) private pure returns (uint16) {
        require(_bytes.length >= _start + 2, "toUint16_outOfBounds");
        uint16 tempUint;

        assembly {
            tempUint := mload(add(add(_bytes, 0x2), _start))
        }

        return tempUint;
    }


    function readUintFromBytes(bytes memory ptr, uint len) private pure returns (uint result) {
        if(len == 1) {
            result = toUint8(ptr, 0);
        } else {
            result = toUint16(ptr, 0);
        }
    }

    // END OF DECODING UTILS
    // ------------------------------------------------------------------------------------

    // ------------------------------------------------------------------------------------
    // RLP DECODING FUNCTIONS

    function batchTypeRlp(uint memPtr, uint end, uint batchType) private {

        if(batchType == 0) {
            rlpNewSingles(memPtr, end);
        } else if (batchType == 2) {
            rlpNewGrouped(memPtr, end);
        } else if (batchType == 4) {
            rlpRepeatingSingles(memPtr, end);
        } else {
            rlpRepeatingGrouped(memPtr, end);
        }

    }

    function rlpNewSingles(uint memPtr, uint end) private {
        address location;
        uint amount;
        uint len;
        uint read;
        uint consumed;
        RawSlice memory data;
        uint nextPtr;
        while (memPtr < end) {
            read = readUint(memPtr, 20);
            location = address(uint160(read));
            memPtr += 20;
            (data, consumed) = parseRLP(memPtr);
            (nextPtr,len) = (data.ptr, data.length);
            amount = readUint(nextPtr, len);
            _registeredAccounts.push(location);
            ERC20._mint(location, amount);
            memPtr += consumed;
        }
    }

    function rlpNewGrouped(uint memPtr, uint end) private {
        address location;
        uint amount;
        uint len;
        uint read;
        uint consumed;
        RawSlice memory data;
        uint nextPtr;
        uint numAddresses;
        while (memPtr < end) {
            (data, consumed) = parseRLP(memPtr);
            (nextPtr,len) = (data.ptr, data.length);
            amount = readUint(nextPtr, len);
            memPtr += consumed;
            (data, consumed) = parseRLP(memPtr);
            (nextPtr,len) = (data.ptr, data.length);
            numAddresses = readUint(nextPtr, len);
            memPtr += consumed;
            for (uint i = 0; i < numAddresses; i++) {
                read = readUint(memPtr, 20);
                location = address(uint160(read));
                memPtr += 20;
                _registeredAccounts.push(location);
                ERC20._mint(location, amount);
            }
        }
    }

    function rlpRepeatingSingles(uint memPtr, uint end) private {
        uint location;
        uint amount;
        uint len;
        uint consumed;
        RawSlice memory data;
        uint nextPtr;
        while (memPtr < end) {
            (data, consumed) = parseRLP(memPtr);
            (nextPtr,len) = (data.ptr, data.length);
            location = readUint(nextPtr, len);
            memPtr += consumed;
            (data, consumed) = parseRLP(memPtr);
            (nextPtr,len) = (data.ptr, data.length);
            amount = readUint(nextPtr, len);
            ERC20._mint(_registeredAccounts[location], amount);
            memPtr += consumed;
        }
    }

    function rlpRepeatingGrouped(uint memPtr, uint end) private {
        uint location;
        uint amount;
        uint len;
        uint consumed;
        RawSlice memory data;
        uint nextPtr;
        uint numAddresses;
        while (memPtr < end) {
            (data, consumed) = parseRLP(memPtr);
            (nextPtr,len) = (data.ptr, data.length);
            amount = readUint(nextPtr, len);
            memPtr += consumed;
            (data, consumed) = parseRLP(memPtr);
            (nextPtr,len) = (data.ptr, data.length);
            numAddresses = readUint(nextPtr, len);
            memPtr += consumed;
            for (uint i = 0; i < numAddresses; i++) {
                (data, consumed) = parseRLP(memPtr);
                (nextPtr,len) = (data.ptr, data.length);
                location = readUint(nextPtr, len);
                memPtr += consumed;
                ERC20._mint(_registeredAccounts[location], amount);
            }
        }
    }

    // END OF RLP DECODING FUNCTIONS
    // ------------------------------------------------------------------------------------

    // ------------------------------------------------------------------------------------
    // NATIVE DECODING FUNCTIONS

    function batchTypeNative(uint memPtr, uint end, uint batchType) private {
        // NEW SINGLES
        if(batchType == 9) {
            nativeNewSingles(memPtr, end, 1);
        } else if (batchType == 1) {
            nativeNewSingles(memPtr, end, 2);
        }
        // NEW GROUPED
        else if (batchType == 43) {
            nativeNewGrouped(memPtr, end, 1, 1);
        } else if (batchType == 11) {
            nativeNewGrouped(memPtr, end, 1, 2);
        } else if (batchType == 35) {
            nativeNewGrouped(memPtr, end, 2, 1);
        } else if (batchType == 3) {
            nativeNewGrouped(memPtr, end, 2, 2);
        }
        // REPEATING SINGLES
        else if (batchType == 29) {
            nativeRepeatingSingles(memPtr, end, 1, 1);
        } else if (batchType == 13) {
            nativeRepeatingSingles(memPtr, end, 1, 2);
        } else if (batchType == 21) {
            nativeRepeatingSingles(memPtr, end, 2, 1);
        } else if (batchType == 5) {
            nativeRepeatingSingles(memPtr, end, 2, 2);
        }
        // REPEATING GROUPED
        else if (batchType == 63) {
            nativeRepeatingGrouped(memPtr, end, 1, 1, 1);
        } else if (batchType == 47) {
            nativeRepeatingGrouped(memPtr, end, 1, 1, 2);
        } else if (batchType == 31) {
            nativeRepeatingGrouped(memPtr, end, 1, 2, 1);
        } else if (batchType == 15) {
            nativeRepeatingGrouped(memPtr, end, 1, 2, 2);
        } else if (batchType == 55) {
            nativeRepeatingGrouped(memPtr, end, 2, 1, 1);
        } else if (batchType == 39) {
            nativeRepeatingGrouped(memPtr, end, 2, 1, 2);
        } else if (batchType == 23) {
            nativeRepeatingGrouped(memPtr, end, 2, 2, 1);
        } else if (batchType == 7) {
            nativeRepeatingGrouped(memPtr, end, 2, 2, 2);
        }
    }

    function nativeNewSingles(uint memPtr, uint end, uint amountLen) private {
        address location;
        uint amount;
        uint read;
        while (memPtr < end) {
            read = readUint(memPtr, 20);
            location = address(uint160(read));
            memPtr += 20;
            amount = readUint(memPtr, amountLen);
            _registeredAccounts.push(location);
            ERC20._mint(location, amount);
            memPtr += amountLen;
        }
    }

    function nativeNewGrouped(uint memPtr, uint end, uint amountLen, uint numAddrLen) private {
        address location;
        uint amount;
        uint read;
        uint numAddresses;
        while (memPtr < end) {
            amount = readUint(memPtr, amountLen);
            memPtr += amountLen;
            numAddresses = readUint(memPtr, numAddrLen);
            memPtr += numAddrLen;
            for (uint i = 0; i < numAddresses; i++) {
                read = readUint(memPtr, 20);
                location = address(uint160(read));
                memPtr += 20;
                _registeredAccounts.push(location);
                ERC20._mint(location, amount);
            }
        }
    }

    function nativeRepeatingSingles(uint memPtr, uint end, uint amountLen, uint idLen) private {
        uint location;
        uint amount;
        while (memPtr < end) {
            location = readUint(memPtr, idLen);
            memPtr += idLen;
            amount = readUint(memPtr, amountLen);
            ERC20._mint(_registeredAccounts[location], amount);
            memPtr += amountLen;
        }
    }

    function nativeRepeatingGrouped(uint memPtr, uint end, uint amountLen, uint numAddrLen, uint idLen) private {
        uint location;
        uint amount;
        uint numAddresses;
        while (memPtr < end) {
            amount = readUint(memPtr, amountLen);
            memPtr += amountLen;
            numAddresses = readUint(memPtr, numAddrLen);
            memPtr += numAddrLen;
            for (uint i = 0; i < numAddresses; i++) {
                location = readUint(memPtr, idLen);
                memPtr += idLen;
                ERC20._mint(_registeredAccounts[location], amount);
            }
        }
    }

    // END OF NATIVE DECODING FUNCTIONS
    // ------------------------------------------------------------------------------------

    // ------------------------------------------------------------------------------------
    // BITMAP DECODING FUNCTIONS (run length encoding)

    function batchTypeBitmap(bytes calldata memPtr, uint batchType) private {

        if(batchType == 255) {
            bitmapRepeatingGrouped(memPtr, 1, 1, 1, 1);
        } else if (batchType == 191) {
            bitmapRepeatingGrouped(memPtr, 1, 1, 1, 2);
        } else if (batchType == 223) {
            bitmapRepeatingGrouped(memPtr, 1, 1, 2, 1);
        } else if (batchType == 159) {
            bitmapRepeatingGrouped(memPtr, 1, 1, 2, 2);

        } else if (batchType == 239) {
            bitmapRepeatingGrouped(memPtr, 1, 2, 1, 1);
        } else if (batchType == 175) {
            bitmapRepeatingGrouped(memPtr, 1, 2, 1, 2);
        } else if (batchType == 207) {
            bitmapRepeatingGrouped(memPtr, 1, 2, 2, 1);
        } else if (batchType == 143) {
            bitmapRepeatingGrouped(memPtr, 1, 2, 2, 2);
        }

        else if (batchType == 247) {
            bitmapRepeatingGrouped(memPtr, 2, 1, 1, 1);
        } else if (batchType == 183) {
            bitmapRepeatingGrouped(memPtr, 2, 1, 1, 2);
        } else if (batchType == 215) {
            bitmapRepeatingGrouped(memPtr, 2, 1, 2, 1);
        } else if (batchType == 151) {
            bitmapRepeatingGrouped(memPtr, 2, 1, 2, 2);
        }

        else if (batchType == 231) {
            bitmapRepeatingGrouped(memPtr, 2, 2, 1, 1);
        } else if (batchType == 167) {
            bitmapRepeatingGrouped(memPtr, 2, 2, 1, 2);
        } else if (batchType == 199) {
            bitmapRepeatingGrouped(memPtr, 2, 2, 2, 1);
        } else if (batchType == 135) {
            bitmapRepeatingGrouped(memPtr, 2, 2, 2, 2);
        }

    }

    function bitmapRepeatingGrouped(bytes calldata data, uint amountLen, uint headerLen, uint rangeLen, uint startIdLen) private {
        uint range;
        uint amount;
        uint headerNumBytes;
        uint startId;

        data = data[1:];

        while(data.length > 0) {
            amount = readUintFromBytes(data, amountLen);
            data = data[amountLen:];
            startId = readUintFromBytes(data, startIdLen);
            data = data[startIdLen:];

            range = readUintFromBytes(data, rangeLen);
            data = data[rangeLen:];

            headerNumBytes = readUintFromBytes(data, headerLen);
            data = data[headerLen:];

            (bytes memory rawBitmap, uint compressedBitmapCounter) = _getRawBitmap(data[:headerNumBytes], data[headerNumBytes:], headerNumBytes);
            //            _verifyRawBitmap(rawBitmap);

            data = data[headerNumBytes + compressedBitmapCounter:];
            _mintFromBitmap(rawBitmap, amount, startId);
        }
    }


    //    function _verifyRawBitmap(bytes memory rawBitmap) private {
//        console.log("verifying rawBitmap");
//        uint8 rawBitmapUint;
//        for( uint i = 0; i < rawBitmap.length; i++) {
//            console.log("i %s", i);
//            rawBitmapUint = uint8(rawBitmap[i]);
//            console.log("ith byte %s", rawBitmapUint);
//        }
//    }


    function _getRawBitmap(bytes calldata headerBytes, bytes calldata data, uint headerNumBytes) private returns (bytes memory rawBitmap, uint compressedBitmapCounter) {
        compressedBitmapCounter = 0;
        uint rawBitmapCounter = 0;
        rawBitmap = new bytes(headerNumBytes * 8);
        for(uint i = 0; i < headerNumBytes; i++) {
            bytes1 headerByte = headerBytes[i];

            uint8 j = 7;
            while(true) {
                uint8 jthBit = uint8(headerByte) & uint8(1 << j);
                if(jthBit == 0) {
                    rawBitmap[rawBitmapCounter] = bytes1(0);
                } else {
                    rawBitmap[rawBitmapCounter] = data[compressedBitmapCounter];
                    compressedBitmapCounter += 1;
                }
                uint8 rawBitmapByte = uint8(rawBitmap[rawBitmapCounter]);
                rawBitmapCounter += 1;

                if(j == 0) {
                    break;
                } else {
                    j--;
                }

            }

        }
    }

//    function _mintFromBitmapInefficient(bytes memory rawBitmap, uint amount, uint startId, uint range) private {
//        uint rawBitmapIndex;
//        uint rawBitmapRemainder;
//        uint8 ithBit;
//        bytes1 rawBitmapByte;
//        uint addrIndex;
//        for (uint i = 0; i < range; i++) {
//            rawBitmapIndex = i/8;
//            rawBitmapRemainder = i % 8;
//            rawBitmapIndex = rawBitmap.length - rawBitmapIndex - 1;
//            rawBitmapByte = rawBitmap[rawBitmapIndex];
//            uint8 rawBitmapByteUint = uint8(rawBitmapByte);
//
//            ithBit = uint8(rawBitmapByte) & uint8(1 << rawBitmapRemainder);
//
//            if(ithBit != 0) {
//                addrIndex = i + startId;
//                ERC20._mint(_registeredAccounts[addrIndex], amount);
//            }
//        }
//    }

    function _mintFromBitmap(bytes memory rawBitmap, uint amount, uint startId) private {
        uint rawBitmapIndex;
        uint rawBitmapRemainder;
        uint8 currBit;
        uint8 currByte;
        uint addrIndex;

        uint currBytePointer = rawBitmap.length - 1;

        uint indexCounter = 0;
        while(true) {

            currByte = uint8(rawBitmap[currBytePointer]);

            for(uint8 j = 0; j < 8; j++) {
                currBit = currByte & uint8(1 << j);
                if(currBit != 0) {
                    addrIndex = indexCounter + startId;
                    ERC20._mint(_registeredAccounts[addrIndex], amount);
                }
                indexCounter++;
            }
            if(currBytePointer == 0) {
                break;
            } else {
                currBytePointer--;
            }
        }


    }

    // END OF BITMAP DECODING FUNCTIONS (run length encoding)
    // ------------------------------------------------------------------------------------

    // END OF BATCH MINTING
    // ------------------------------------------------------------------------------------

    function mint(
        address operator,
        address account,
        uint256 amount,
        bytes calldata userData,
        bytes calldata operatorData
    ) override external {
        require(_msgSender() == _distributionContract, "SubredditPoints: only distribution contract can mint points");

        ERC20._mint(account, amount);
        emit Minted(operator, account, amount, userData, operatorData);
    }

    function burn(
        uint256 amount,
        bytes calldata userData
    ) override external {
        address account = _msgSender();
        _burn(account, account, amount, userData, "");
    }

    function isOperatorFor(
        address operator,
        address tokenHolder
    ) public view returns (bool) {
        return operator == tokenHolder ||
        (_defaultOperators[operator] && !_revokedDefaultOperators[tokenHolder][operator]) ||
        _operators[tokenHolder][operator];
    }

    function authorizeOperator(address operator) external {
        require(_msgSender() != operator, "SubredditPoints: authorizing self as operator");
        require(address(0) != operator, "SubredditPoints: operator can't have 0 address");

        if (_defaultOperators[operator]) {
            delete _revokedDefaultOperators[_msgSender()][operator];
        } else {
            _operators[_msgSender()][operator] = true;
        }

        emit AuthorizedOperator(operator, _msgSender());
    }

    function revokeOperator(address operator) external {
        require(operator != _msgSender(), "SubredditPoints: revoking self as operator");
        require(address(0) != operator, "SubredditPoints: operator can't have 0 address");

        if (_defaultOperators[operator]) {
            _revokedDefaultOperators[_msgSender()][operator] = true;
        } else {
            delete _operators[_msgSender()][operator];
        }

        emit RevokedOperator(operator, _msgSender());
    }

    function operatorSend(
        address sender,
        address recipient,
        uint256 amount,
        bytes calldata userData,
        bytes calldata operatorData
    ) external {
        address operator = _msgSender();
        require(isOperatorFor(operator, sender), "SubredditPoints: caller is not an operator for holder");
        _transfer(sender, recipient, amount);
        emit Sent(operator, sender, recipient, amount, userData, operatorData);
    }

    function operatorBurn(
        address account,
        uint256 amount,
        bytes calldata data,
        bytes calldata operatorData
    ) override external {
        address operator = _msgSender();
        require(isOperatorFor(operator, account), "SubredditPoints: caller is not an operator for holder");
        _burn(operator, account, amount, data, operatorData);
    }

    function defaultOperators() external view returns (address[] memory) {
        return _defaultOperatorsArray;
    }

    function addDefaultOperator(address operator) external onlyOwner {
        require(operator != address(0), "SubredditPoints: operator address shouldn't be 0");
        require(!_defaultOperators[operator], "SubredditPoints: operator already exists");

        _defaultOperatorsArray.push(operator);
        _defaultOperators[operator] = true;

        emit DefaultOperatorAdded(operator);
    }

    function removeDefaultOperator(address operator) external onlyOwner {
        require(operator != address(0), "SubredditPoints: operator address shouldn't be 0");
        require(_defaultOperators[operator], "SubredditPoints: operator doesn't exists");

        for (uint256 i = 0; i < _defaultOperatorsArray.length; i++) {
            if (_defaultOperatorsArray[i] == operator) {
                if (i != (_defaultOperatorsArray.length - 1)) {// if it's not last element, replace it from the tail
                    _defaultOperatorsArray[i] = _defaultOperatorsArray[_defaultOperatorsArray.length - 1];
                }
                _defaultOperatorsArray.pop();
                break;
            }
        }
        delete _defaultOperators[operator];

        emit DefaultOperatorRemoved(operator);
    }

    function _burn(
        address operator,
        address account,
        uint256 amount,
        bytes memory userData,
        bytes memory operatorData
    ) internal {
        ERC20._burn(account, amount);
        emit Burned(operator, account, amount, userData, operatorData);
    }

    function subreddit() override external view returns (string memory) {
        return _subreddit;
    }

    function updateDistributionContract(address distributionContract_) public onlyOwner {
        require(distributionContract_ != address(0), "SubredditPoints: distributionContract should not be 0");
        _distributionContract = distributionContract_;
    }

    function distributionContract() external view returns (address) {
        return _distributionContract;
    }

}