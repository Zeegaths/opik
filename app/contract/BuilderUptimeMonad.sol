// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract BuilderUptimeMonad {
    // Stores your check-ins with IPFS data
    struct CheckIn {
        uint8 score;        // Your uptime % (0-100)
        uint256 timestamp;  // When you checked in
        string ipfsCID;     // IPFS Content Identifier for detailed data
        string dataType;    // Type of data: "tasks", "analysis", "full"
    }
    
    // YOUR_ADDRESS => [all your check-ins]
    mapping(address => CheckIn[]) public userCheckIns;
    
    // Track total check-ins per user
    mapping(address => uint256) public userCheckInCount;
    
    // Events for better tracking
    event CheckInRecorded(
        address indexed user,
        uint8 score,
        uint256 timestamp,
        string ipfsCID,
        string dataType
    );
    
    event DataRetrieved(
        address indexed user,
        string ipfsCID,
        string dataType
    );
    
    // Function to record a check-in with IPFS CID
    function recordCheckIn(
        uint8 _score, 
        string memory _ipfsCID, 
        string memory _dataType
    ) external {
        require(_score <= 100, "Score must be 0-100");
        require(bytes(_ipfsCID).length > 0, "IPFS CID required");
        require(bytes(_dataType).length > 0, "Data type required");
        
        // User OR AI agent (with delegation) can call this
        userCheckIns[msg.sender].push(CheckIn(
            _score, 
            block.timestamp, 
            _ipfsCID, 
            _dataType
        ));
        
        userCheckInCount[msg.sender]++;
        
        emit CheckInRecorded(
            msg.sender, 
            _score, 
            block.timestamp, 
            _ipfsCID, 
            _dataType
        );
    }
    
    // Get all check-ins for a user
    function getUserCheckIns(address _user) external view returns (CheckIn[] memory) {
        return userCheckIns[_user];
    }
    
    // Get latest check-in for a user
    function getLatestCheckIn(address _user) external view returns (CheckIn memory) {
        require(userCheckIns[_user].length > 0, "No check-ins found");
        return userCheckIns[_user][userCheckIns[_user].length - 1];
    }
    
    // Get check-ins by data type
    function getCheckInsByType(
        address _user, 
        string memory _dataType
    ) external view returns (CheckIn[] memory) {
        CheckIn[] memory allCheckIns = userCheckIns[_user];
        CheckIn[] memory filteredCheckIns = new CheckIn[](allCheckIns.length);
        uint256 count = 0;
        
        for (uint256 i = 0; i < allCheckIns.length; i++) {
            if (keccak256(bytes(allCheckIns[i].dataType)) == keccak256(bytes(_dataType))) {
                filteredCheckIns[count] = allCheckIns[i];
                count++;
            }
        }
        
        // Resize array to actual count
        CheckIn[] memory result = new CheckIn[](count);
        for (uint256 i = 0; i < count; i++) {
            result[i] = filteredCheckIns[i];
        }
        
        return result;
    }
    
    // Get user statistics
    function getUserStats(address _user) external view returns (
        uint256 totalCheckIns,
        uint8 averageScore,
        uint256 lastCheckIn
    ) {
        CheckIn[] memory checkIns = userCheckIns[_user];
        totalCheckIns = checkIns.length;
        
        if (totalCheckIns == 0) {
            return (0, 0, 0);
        }
        
        uint256 totalScore = 0;
        for (uint256 i = 0; i < checkIns.length; i++) {
            totalScore += checkIns[i].score;
        }
        
        averageScore = uint8(totalScore / totalCheckIns);
        lastCheckIn = checkIns[checkIns.length - 1].timestamp;
        
        return (totalCheckIns, averageScore, lastCheckIn);
    }
    
    // Function to record check-in on behalf of another user (for AI agent with delegation)
    function recordCheckInForUser(
        address _user,
        uint8 _score,
        string memory _ipfsCID,
        string memory _dataType
    ) external {
        require(_score <= 100, "Score must be 0-100");
        require(bytes(_ipfsCID).length > 0, "IPFS CID required");
        require(bytes(_dataType).length > 0, "Data type required");
        
        // This function can be called by delegated AI agents
        userCheckIns[_user].push(CheckIn(
            _score,
            block.timestamp,
            _ipfsCID,
            _dataType
        ));
        
        userCheckInCount[_user]++;
        
        emit CheckInRecorded(
            _user,
            _score,
            block.timestamp,
            _ipfsCID,
            _dataType
        );
    }
}
