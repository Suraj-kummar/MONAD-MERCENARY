// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title MonadMercenary
 * @dev Simple Bounty Marketplace for Hackathon Demo
 */
interface IERC20 {
    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);
    function transfer(address recipient, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

contract MonadMercenary {
    struct Quest {
        uint id;
        address poster;
        string description;
        uint reward;
        address token; // address(0) for native MON
        bool isCompleted;
        address winner;
    }

    Quest[] public quests;
    uint public nextId;

    // Reputation Mapping: address => XP points
    mapping(address => uint) public mercenaryXP;

    event QuestPosted(uint indexed id, address indexed poster, uint reward, address token);
    event QuestCompleted(uint indexed id, address indexed winner, uint reward, address token, uint xpGained);

    function postQuest(string memory _desc) public payable {
        require(msg.value > 0, "Reward must be > 0");
        quests.push(Quest(nextId, msg.sender, _desc, msg.value, address(0), false, address(0)));
        emit QuestPosted(nextId, msg.sender, msg.value, address(0));
        nextId++;
    }

    /**
     * @notice Posts a quest with ERC20 token reward.
     */
    function postQuestERC20(string memory _desc, address _token, uint _amount) public {
        require(_amount > 0, "Reward must be > 0");
        require(_token != address(0), "Invalid token address");
        
        bool success = IERC20(_token).transferFrom(msg.sender, address(this), _amount);
        require(success, "Transfer failed");

        quests.push(Quest(nextId, msg.sender, _desc, _amount, _token, false, address(0)));
        emit QuestPosted(nextId, msg.sender, _amount, _token);
        nextId++;
    }

    /**
     * @notice Releases the bounty reward to the mercenary and increments their XP.
     */
    function payoutMercenary(uint _id, address _mercenary) public {
        require(_id < quests.length, "Invalid quest ID");
        Quest storage q = quests[_id];
        require(msg.sender == q.poster, "Only poster can payout");
        require(!q.isCompleted, "Quest already completed");
        require(_mercenary != address(0), "Invalid mercenary address");
        
        q.isCompleted = true;
        q.winner = _mercenary;

        uint xpGain = 10;
        mercenaryXP[_mercenary] += xpGain;
        
        if (q.token == address(0)) {
            (bool sent, ) = _mercenary.call{value: q.reward}("");
            require(sent, "Failed to send Ether");
        } else {
            bool success = IERC20(q.token).transfer(_mercenary, q.reward);
            require(success, "Token transfer failed");
        }
        
        emit QuestCompleted(_id, _mercenary, q.reward, q.token, xpGain);
    }

    function getActiveQuests() public view returns (Quest[] memory) {
        return quests;
    }

    /**
     * @notice Returns the reputation (XP) of a specific address.
     */
    function getReputation(address _user) public view returns (uint) {
        return mercenaryXP[_user];
    }
}
