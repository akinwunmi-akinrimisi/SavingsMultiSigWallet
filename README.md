**Multisig Wallet Features:**

1. **Minimum Users:**
   - A minimum of 3 users is required to create the wallet.
   
2. **Monthly Contributions:**
   - Users contribute Ether into the wallet on a monthly basis.
   - Each month’s contribution must be equal to or greater than the previous month’s contribution to ensure consistent savings.

3. **Flexible Contribution Tracking:**
   - Users are allowed to make up for missed contributions in subsequent months by increasing their deposit.
   - The contract will track missed contributions and allow users to compensate without penalties.

4. **Withdrawal Conditions:**
   - Withdrawals can only be initiated once every 6 months by any user.
   - The amount withdrawn by a user is limited to their total saved balance, excluding any shared interest from investments.
   - A 5% withdrawal fee is deducted.
   - Users can only view their own balance and are restricted from seeing others' savings.

5. **Withdrawal Timing Flexibility:**
   - Users may propose an early withdrawal if needed, triggering a vote among the participants.
   - A majority vote (based on the number of participants) is required for the early withdrawal to be approved.
   - Early withdrawals are subject to the standard 5% fee, or a special fee could apply.

6. **Emergency Withdrawal:**
   - Users may initiate an emergency withdrawal at any time, subject to a 10% fee.
   - The emergency withdrawal feature is meant for unforeseen financial needs.

7. **Quorum for Decisions:**
   - Any decision involving the wallet (such as investments or updates to the contract) requires a quorum based on the total number of participants. For example, if there are 5 participants, at least 3 must agree for the decision to pass.

8. **Investment Feature:**
   - Once the total savings in the wallet reach a predefined minimum threshold, a percentage of the funds (e.g., 70%) can be invested via the contract for a monthly return of 2%.
   - The remaining balance (e.g., 30%) is kept liquid to ensure withdrawals can be processed.

9. **Automated Interest Distribution:**
   - The interest earned from the investments is automatically distributed to each user’s balance at the end of every month, even if no withdrawal is initiated.
   - This allows users to see their savings grow in real time and incentivizes continued participation.

10. **Multi-Asset Support:**
    - The wallet supports multiple types of assets, including ERC20 tokens and stablecoins like USDC, DAI, etc.
    - Users can choose to save and invest in different asset types, providing flexibility and diversification.

11. **Transaction Logs:**
    - The wallet provides a transaction log for each user, where they can review all their deposits, withdrawals, and interest earnings.
    - This ensures transparency and allows users to track their financial activity over time.

