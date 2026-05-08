// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title LokaPayLedger
/// @notice Merchant payment ledger for Celo native and ERC-20 stablecoin payments.
contract LokaPayLedger is Ownable {
    using SafeERC20 for IERC20;

    uint256 public constant BPS_DENOMINATOR = 10_000;
    uint256 public constant MAX_FEE_BPS = 500;

    address payable public treasury;
    uint256 public feeBps;
    uint256 public totalPayments;

    struct Receipt {
        bytes32 invoiceId;
        address payer;
        address merchant;
        address token;
        uint256 amount;
        uint256 fee;
        bytes32 memoHash;
        uint64 paidAt;
    }

    mapping(uint256 receiptId => Receipt receipt) public receipts;
    mapping(bytes32 invoiceId => uint256 count) public invoicePaymentCount;

    event LokaPayment(
        uint256 indexed receiptId,
        bytes32 indexed invoiceId,
        address indexed merchant,
        address payer,
        address token,
        uint256 amount,
        uint256 fee,
        bytes32 memoHash
    );
    event TreasuryUpdated(address indexed oldTreasury, address indexed newTreasury);
    event FeeBpsUpdated(uint256 oldFeeBps, uint256 newFeeBps);

    constructor(
        address initialOwner_,
        address payable treasury_,
        uint256 feeBps_
    ) Ownable(initialOwner_) {
        require(initialOwner_ != address(0), "OWNER_ZERO");
        require(feeBps_ <= MAX_FEE_BPS, "FEE_TOO_HIGH");

        treasury = treasury_ == address(0) ? payable(initialOwner_) : treasury_;
        feeBps = feeBps_;
    }

    function payNative(
        bytes32 invoiceId,
        address payable merchant,
        bytes32 memoHash
    ) external payable returns (uint256 receiptId) {
        require(msg.value > 0, "AMOUNT_ZERO");
        require(invoiceId != bytes32(0), "INVOICE_EMPTY");
        require(merchant != address(0), "MERCHANT_ZERO");

        uint256 fee = _feeFor(msg.value);
        uint256 payout = msg.value - fee;

        receiptId = _recordPayment(
            invoiceId,
            msg.sender,
            merchant,
            address(0),
            msg.value,
            fee,
            memoHash
        );

        if (fee > 0) {
            (bool feeOk, ) = treasury.call{value: fee}("");
            require(feeOk, "FEE_TRANSFER_FAILED");
        }

        (bool payOk, ) = merchant.call{value: payout}("");
        require(payOk, "PAYMENT_TRANSFER_FAILED");
    }

    function payToken(
        bytes32 invoiceId,
        address merchant,
        address token,
        uint256 amount,
        bytes32 memoHash
    ) external returns (uint256 receiptId) {
        require(amount > 0, "AMOUNT_ZERO");
        require(invoiceId != bytes32(0), "INVOICE_EMPTY");
        require(merchant != address(0), "MERCHANT_ZERO");
        require(token != address(0), "TOKEN_ZERO");

        IERC20 paymentToken = IERC20(token);
        uint256 fee = _feeFor(amount);
        uint256 payout = amount - fee;

        paymentToken.safeTransferFrom(msg.sender, address(this), amount);

        receiptId = _recordPayment(
            invoiceId,
            msg.sender,
            merchant,
            token,
            amount,
            fee,
            memoHash
        );

        if (fee > 0) {
            paymentToken.safeTransfer(treasury, fee);
        }
        paymentToken.safeTransfer(merchant, payout);
    }

    function setTreasury(address payable newTreasury) external onlyOwner {
        require(newTreasury != address(0), "TREASURY_ZERO");

        address oldTreasury = treasury;
        treasury = newTreasury;

        emit TreasuryUpdated(oldTreasury, newTreasury);
    }

    function setFeeBps(uint256 newFeeBps) external onlyOwner {
        require(newFeeBps <= MAX_FEE_BPS, "FEE_TOO_HIGH");

        uint256 oldFeeBps = feeBps;
        feeBps = newFeeBps;

        emit FeeBpsUpdated(oldFeeBps, newFeeBps);
    }

    function _recordPayment(
        bytes32 invoiceId,
        address payer,
        address merchant,
        address token,
        uint256 amount,
        uint256 fee,
        bytes32 memoHash
    ) internal returns (uint256 receiptId) {
        receiptId = ++totalPayments;
        invoicePaymentCount[invoiceId] += 1;

        receipts[receiptId] = Receipt({
            invoiceId: invoiceId,
            payer: payer,
            merchant: merchant,
            token: token,
            amount: amount,
            fee: fee,
            memoHash: memoHash,
            paidAt: uint64(block.timestamp)
        });

        emit LokaPayment(
            receiptId,
            invoiceId,
            merchant,
            payer,
            token,
            amount,
            fee,
            memoHash
        );
    }

    function _feeFor(uint256 amount) internal view returns (uint256) {
        return (amount * feeBps) / BPS_DENOMINATOR;
    }

    receive() external payable {}
}
