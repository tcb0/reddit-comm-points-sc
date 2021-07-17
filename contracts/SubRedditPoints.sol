/**
 *Submitted for verification at Etherscan.io on 2020-06-09
*/

// File: @openzeppelin/upgrades/contracts/Initializable.sol

pragma solidity >=0.4.24 <=0.6.0;
import "hardhat/console.sol";

import "./lib.sol";



// ERC20 and borrows only operators notion from ERC777, accounts can revoke default operator
contract SubredditPoints_v0 is Initializable, ISubredditPoints, Ownable, UpdatableGSNRecipientSignature, ERC20 {
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

    function initialize(
        address owner_,
        address gsnApprover_,
        address distributionContract_,
        string calldata subreddit_,
        string calldata name_,
        string calldata symbol_,

        address[] calldata defaultOperators_
    ) external initializer {
        require(bytes(subreddit_).length != 0, "SubredditPoints: subreddit can't be empty");
        require(bytes(name_).length != 0, "SubredditPoints: name can't be empty");
        require(bytes(symbol_).length != 0, "SubredditPoints: symbol can't be empty");
        require(owner_ != address(0), "SubredditPoints: owner should not be 0");

        Ownable.initialize(owner_);
        UpdatableGSNRecipientSignature.initialize(gsnApprover_);

        updateDistributionContract(distributionContract_);

        _subreddit = subreddit_;
        _name = name_;
        _symbol = symbol_;

        _defaultOperatorsArray = defaultOperators_;
        for (uint256 i = 0; i < defaultOperators_.length; i++) {
            _defaultOperators[defaultOperators_[i]] = true;
            emit DefaultOperatorAdded(defaultOperators_[i]);
        }
    }

    function mint(
        address operator,
        address account,
        uint256 amount,
        bytes calldata userData,
        bytes calldata operatorData
    ) external {
        require(_msgSender() == _distributionContract, "SubredditPoints: only distribution contract can mint points");

        ERC20._mint(account, amount);
        emit Minted(operator, account, amount, userData, operatorData);
    }

    function batchMint(bytes calldata data) external {
        require(_msgSender() == _distributionContract, "SubredditPoints: only distribution contract can mint points");
        console.log("Batch minting, SubRedditPoints...");

        bytes memory input = data;

        uint memPtr;
        assembly {
            memPtr := add(input, 0x20)
        }
        uint end = memPtr + input.length;
        uint byte0 = readUint(memPtr, 1);
        console.log("Byte 0 %s...", byte0);
        memPtr += 1;
        if (byte0 == 0) {
            batchType1(memPtr,end,1);
        } else if (byte0 == 1) {
            batchType1(memPtr,end,1);
        } else if (byte0 == 2) {
            batchType2(memPtr,end, 1, 1);
        } else if (byte0 == 3) {
            batchType2(memPtr,end, 1, 2);
        } else if (byte0 == 4) {
            batchType2(memPtr,end, 2, 1);
        } else if (byte0 == 5) {
            batchType2(memPtr,end, 2, 2);
        } else if (byte0 == 6) {
            batchType3(memPtr,end, 1, 1);
        } else if (byte0 == 6) {
            batchType3(memPtr,end, 1, 1);
        } else if (byte0 == 7) {
            batchType3(memPtr,end, 1, 2);
        } else if (byte0 == 8) {
            batchType3(memPtr,end, 2, 1);
        } else if (byte0 == 9) {
            batchType3(memPtr,end, 2, 2);
        } else if (byte0 == 10) {
            batchType4(memPtr,end, 1, 1, 1);
        } else if (byte0 == 11) {
            batchType4(memPtr,end, 1, 1, 2);
        } else if (byte0 == 12) {
            batchType4(memPtr,end, 1, 2, 1);
        } else if (byte0 == 13) {
            batchType4(memPtr,end, 2, 1, 1);
        } else if (byte0 == 14) {
            batchType4(memPtr,end, 2, 1, 2);
        } else if (byte0 == 15) {
            batchType4(memPtr,end, 2, 2, 1);
        } else if (byte0 == 16) {
            batchType4(memPtr,end, 1, 2, 2);
        } else {
            batchType4(memPtr,end, 2, 2, 2);
        }
    }

    function burn(
        uint256 amount,
        bytes calldata userData
    ) external {
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
    ) external {
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
                if (i != (_defaultOperatorsArray.length - 1)) { // if it's not last element, replace it from the tail
                    _defaultOperatorsArray[i] = _defaultOperatorsArray[_defaultOperatorsArray.length-1];
                }
                _defaultOperatorsArray.length = _defaultOperatorsArray.length - 1;
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

    function subreddit() external view returns (string memory) {
        return _subreddit;
    }

    function name() external view returns (string memory) {
        return _name;
    }

    function symbol() external view returns (string memory) {
        return _symbol;
    }

    function updateGSNApprover(address gsnApprover) external onlyOwner {
        updateSigner(gsnApprover);
    }

    function updateDistributionContract(address distributionContract_) public onlyOwner {
        require(distributionContract_ != address(0), "SubredditPoints: distributionContract should not be 0");
        _distributionContract = distributionContract_;
    }

    function distributionContract() external view returns (address) {
        return _distributionContract;
    }


    function readUint(uint ptr, uint len) private pure returns(uint) {
        uint result;
        assembly {
            result := mload(ptr)
            if lt(len, 32) {
                result := div(result, exp(256, sub(32, len)))
            }
        }
        return result;
    }
    
    function batchType1(uint memPtr, uint end, uint len) private {
        console.log("Batch type 1");
        address location;
        uint16 amount;
        uint read;
        while(memPtr < end) {
            read = readUint(memPtr,20);
            location = address(read);
            console.log("Address %s", location);
            memPtr += 20;
            read = readUint(memPtr,len);
            amount = uint16(read);
            console.log("Amount %s", amount);
            _registeredAccounts.push(location);
            ERC20._mint(location, amount);
            memPtr += len;
        }
    }

    function batchType2(uint memPtr, uint end, uint newAddrLen, uint amountLen) private {
        address location;
        uint16 amount;
        uint read;
        uint num_addresses;
        while(memPtr < end) {
            read = readUint(memPtr,amountLen);
            amount = uint16(read);
            memPtr += amountLen;
            num_addresses = readUint(memPtr,newAddrLen);
            memPtr += newAddrLen;
            for(uint i = 0; i < num_addresses; i++) {
                read = readUint(memPtr,20);
                location = address(read);
                memPtr += 20;
                _registeredAccounts.push(location);
                ERC20._mint(location, amount);
            }
        }
    }

    function batchType3(uint memPtr, uint end, uint addrLen, uint amountLen) private {
        uint location;
        uint16 amount;
        uint read;
        while(memPtr < end) {
            location = readUint(memPtr, addrLen);
            memPtr += addrLen;
            read = readUint(memPtr, amountLen);
            amount = uint16(read);
            ERC20._mint(_registeredAccounts[location], amount);
            memPtr += amountLen;
        }
    }

    function batchType4(uint memPtr, uint end, uint addrLen, uint numAddrLen, uint amountLen) private {
        uint location;
        uint16 amount;
        uint read;
        uint num_addresses;
        while(memPtr < end) {
            read = readUint(memPtr,amountLen);
            amount = uint16(read);
            memPtr += amountLen;
            num_addresses = readUint(memPtr,numAddrLen);
            memPtr += numAddrLen;
            for(uint i = 0; i < num_addresses; i++) {
                location = readUint(memPtr,addrLen);
                memPtr += addrLen;
                ERC20._mint(_registeredAccounts[location], amount);
            }
        }
    }
}