// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title MonadMercenary
 * @dev Simple Bounty Marketplace for Hackathon Demo
 */
contract MonadMercenary {
    struct Quest {
        uint id;
        address poster;
        string description;
        uint reward;
        bool isCompleted;
        address winner;
    }

    Quest[] public quests;
    uint public nextId;

    event QuestPosted(uint indexed id, address indexed poster, uint reward);
    event QuestCompleted(uint indexed id, address indexed winner);

    function postQuest(string memory _desc) public payable {
        require(msg.value > 0, "Reward must be > 0");
        quests.push(Quest(nextId, msg.sender, _desc, msg.value, false, address(0)));
        emit QuestPosted(nextId, msg.sender, msg.value);
        nextId++;
    }

    /**
     * @notice Releases the bounty reward to the mercenary.
     * @dev Only the quest poster can call this. 
     * @param _id The ID of the quest to settle.
     * @param _mercenary The address of the mercenary who completed the task.
     */
    function payoutMercenary(uint _id, address _mercenary) public {
        Quest storage q = quests[_id];
        require(msg.sender == q.poster, "Only poster can payout");
        require(!q.isCompleted, "Quest already completed");
        
        q.isCompleted = true;
        q.winner = _mercenary;
        
        // Payout to the mercenary
        // Uses .call to prevent re-entrancy issues with strict gas limits
        (bool sent, ) = _mercenary.call{value: q.reward}("");
        require(sent, "Failed to send Ether");
        
        emit QuestCompleted(_id, _mercenary);
    }

    function getActiveQuests() public view returns (Quest[] memory) {
        return quests;
    }
}
