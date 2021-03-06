let selectedGuildId;
let selectedChannelId;

let channelList;
let messagesList = [];
let usersList = [];

let IsEmbedded;

const getPrettyTime = (date) => {
	const time = date.toLocaleTimeString();
	//return (p => `${p[0]}:${p[1]} ${p[2]}`)(date.toLocaleTimeString().split(':').map(a => a.split(' ').pop()));
	const out = time.slice(0, -6) + time.slice(-3); // credit to Jessica Creighton: https://discord.com/channels/717878806248947785/718369600906985474/816911423572803595, https://jsben.ch/wLz8J
	return out;
};
const getPrettyTimestamp = (snowflake) => {
	const day = 24 * 60 * 60 * 1000;
	const today = new Date();
	for (let comp of ['Hour', 'Minute', 'Second', 'Millisecond'])
		today[`set${comp}s`](0);
	const datetime = new Date(((BigInt(snowflake) >> 22n).toString() - 0) + 1420070400000);
	const time = getPrettyTime(datetime);
	const date = new Date(datetime);
	for (let comp of ['Hour', 'Minute', 'Second', 'Millisecond'])
		date[`set${comp}s`](0);
	const diff = (today - date)/day; // positive means message is from the past; negative is from the future; one day is 86400000
	// if it's today, it'll definitely have the same date and month and year
	if (diff === 0) return 'Today at ' + time;
	// if it's yesterday or tomorrow, it could have a different month and/or year
	// essentially, we check that it's less than two days away
	if (diff ===  1) return 'Yesterday at ' + time;
	if (diff === -1) return 'Tomorrow at ' + time; // you never know
	if (diff <= 7) // within the last week
		switch (date.getDay()) {
			case 0: return 'Sunday at ' + time;
			case 1: return 'Monday at ' + time;
			case 2: return 'Tuesday at ' + time;
			case 3: return 'Wednesday at ' + time;
			case 4: return 'Thursday at ' + time;
			case 5: return 'Friday at ' + time;
			case 6: return 'Saturday at ' + time;
		}
	return date.toLocaleDateString();
};

//Get current guild and channel ids out of the URL if they are present
const getIdFromURL = (typeOfID) => {
  let url = window.location.href;
  if (typeOfID == "guild") {
    try {
      return url.split("/app")[1].split("/")[1];
    } catch (error) {}
  } else if ((typeOfID = "channel")) {
    try {
      return url.split("/app")[1].split("/")[2];
    } catch (error) {}
  }
  return null;
};
selectedGuildId = getIdFromURL("guild");
selectedChannelId = getIdFromURL("channel");

const updateChannelList = (addToHistory) => {
  
  fetch(`/api/${APIVERSION}/guilds/${selectedGuildId}/text-channels`)
    .then((response) => response.json())
    .then((data) => {
      clearChannelList();
      channelList = data;
      //sort by position
      channelList.sort((a, b) => (a.position > b.position ? 1 : -1));
      createChannelList(data, addToHistory);
    });
};
const clearChannelList = () => {
  document.getElementById("channelList").innerHTML = "";
};
const createChannelList = (channelList, addToHistory) => {
  //create divs and append to container
  channelList.forEach((channel) => {
    let div = document.createElement("div");
    div.classList.add("channel");
    div.dataset.channelId = channel.channel_id;
    div.addEventListener("click", () =>
      changeChannel(channel.channel_id, true)
    );
    let name = document.createElement("p");
    name.innerHTML = "#" + channel.name;
    div.appendChild(name);
    document.getElementById("channelList").appendChild(div);
  });

  //show selected channel. if channel is invalid or unspecified,show first channel in list
  if (selectedChannelId) {
    if (!changeChannel(selectedChannelId, addToHistory)) {
      if (channelList.length > 0)
        changeChannel(channelList[0].channel_id, addToHistory);
      else noChannelSelected();
    }
  } else if (channelList.length > 0) changeChannel(channelList[0].channel_id, addToHistory);
    else noChannelSelected();
};

//Get messages for new channel, change selected channel styles
const changeChannel = (newChannelId, addToHistory) => {
  let newChannelExists = false;
  let newChannelName;
  //Search list for new channel
  channelList.forEach((channel) => {
    if (channel.channel_id == newChannelId) {
      newChannelExists = true;
      newChannelName = channel.name;
    }
  });
  //if new channel exists, switch to it
  if (newChannelExists) {
    hideNoChannelScreen();
    //Remove selected from all channels
    [...document.getElementById("channelList").children].forEach((channel) => {
      channel.classList.remove("selected");
    });
    //add selected class to new selected channel
    document
      .querySelector('[data-channel-id="' + newChannelId + '"]')
      .classList.add("selected");
    //Change current channel name
    document.getElementById("channelName").innerHTML = `#${newChannelName}`;

    //Update selected channel id
    socket.emit("old room", selectedChannelId);
    selectedChannelId = newChannelId;
    socket.emit("new room", selectedChannelId);

    //Update url and history
    if (addToHistory) updateHistory();

    //Repopulate messages
    getMessages();

  }

  return newChannelExists;
};

const noChannelSelected = () => {
  //Remove selected from all channels
  [...document.getElementById("channelList").children].forEach((channel) => {
    channel.classList.remove("selected");
  });

  //Change current channel name
  document.getElementById("channelName").innerHTML = "";

  //Update selected channel id
  socket.emit("old room", selectedChannelId);
  selectedChannelId = 1;
  socket.emit("new room", selectedChannelId);

  //update url and history
  updateHistory();

  showNoChannelScreen();
};

const getMessages = () => {
  clearMessagesArea();
  fetch(
    `/api/${APIVERSION}/guilds/${selectedGuildId}/text-channels/${selectedChannelId}/messages?limit=32`
  )
    .then((response) => response.json())
    .then((data) => {
      messagesList = data.sort((a, b) =>
        a.message_id < b.message_id ? -1 : 1
      );
      if(messagesList.length == 0) addNoMessagesImage();
      populateMessages();

      //scroll browswer to bottom of messages list
      const chatArea = document.getElementsByClassName("chat-area")[0];
      chatArea.scrollTop = chatArea.scrollHeight;
    });
};

const clearMessagesArea = () => {
  document.getElementById("chatArea").innerHTML = "";
};

const addNoMessagesImage = () => {
  let imageDiv = document.createElement("div");
  imageDiv.classList.add("no-message-div");

  let image = document.createElement("img");
  image.src = "/images/Cat_Friend.svg";

  let message = document.createElement("p");
  message.innerHTML = "Start up the chat by sending a message!";

  imageDiv.appendChild(image);
  imageDiv.appendChild(message);

  document.getElementById("chatArea").appendChild(imageDiv);
};

//Create message div for each message and append to screen
const populateMessages = () => {
  if (messagesList.length > 0) clearMessagesArea();
  messagesList.forEach((message) => {
    addMessage(message);
  });
};

const addMessage = (message) => {
  let div = document.createElement("div");
  div.classList.add("message");
  div.dataset.messageId = message.message_id;

  let imgContainer = document.createElement("div");
  imgContainer.classList.add("img-circle");

  let image = document.createElement("img");

  let currUser = getUserById(message.author_id);
  image.src = `/api/${APIVERSION}/icons/` + currUser.icon_id;
  image.classList.add("img");
  imgContainer.appendChild(image);

  let messageSection = document.createElement("div");
  messageSection.classList.add("message-section");

  let titleBar = document.createElement("div");
  titleBar.classList.add("title-bar");

  let userName = document.createElement("p");
  userName.classList.add("username");
  userName.innerHTML = currUser.name;

  let timestamp = document.createElement("span");
  timestamp.classList.add("timestamp");
  //TODO: FIX LATER
  timestamp.innerHTML = getPrettyTimestamp(message.message_id);

  titleBar.appendChild(userName);
  titleBar.appendChild(timestamp);

  let messageContent = document.createElement("p");
  messageContent.classList.add("content");

  //Removes Link Texts And Applies To A-tag
  let msgArray = message.body.split(" ");
  msgArray.forEach((message, index) => {
    if (message.startsWith("https://")) {
      msgArray.splice(index, 1);
    }
  });

  messageContent.innerHTML = msgArray.join(" ");

  let messageArray = message.body.split(" ");
  messageArray.forEach((message) => {
    if (message.startsWith("https://")) {
      //Adds Link below message
      if (!message.startsWith("https://tenor.com")) {
        let linkTag = document.createElement("a");
        linkTag.classList.add("link");
        linkTag.href = message;
        linkTag.innerHTML = message;
        messageContent.appendChild(linkTag);
      }

      //Adds IFrame Image/Video
      let embeddedContent = document.createElement("div");
      embeddedContent.classList.add("iframely-embed");

      let embeddedResponsive = document.createElement("div");
      embeddedResponsive.classList.add("iframely-responsive");

      let urlContent = document.createElement("a");
      urlContent.href = message;

      messageContent.appendChild(embeddedContent);
      embeddedContent.appendChild(embeddedResponsive);
      embeddedResponsive.appendChild(urlContent);

      //Needs to check if it is valid
      iframely.load(urlContent);
    }
  });

  messageSection.appendChild(titleBar);
  messageSection.appendChild(messageContent);

  div.appendChild(imgContainer);
  div.appendChild(messageSection);

  document.getElementById("chatArea").appendChild(div);

  //Add message to messagesList
  messagesList.push(message);
};

const getUserById = (userId) => {
  let userObj = {
    user_id: "-1",
    name: "Deleted User",
    icon_id: "1",
    email: "",
    discriminator: 1234,
  };
  usersList.forEach((user) => {
    if (user.user_id == userId) userObj = user;
  });
  return userObj;
};

const changeGuild = (newGuildId, addToHistory) => {
  let newGuildExists = false;
  let newGuildName;
  //Search list for new guild
  [...document.getElementById("guildCollection").children].forEach((guild) => {
    if (guild.dataset.guildId == newGuildId) {
      newGuildExists = true;
      newGuildName = guild.dataset.guildName;
    }
  });
  if (newGuildExists) {
    clearMessagesArea();
    //Remove selected class from all guilds
    [...document.getElementById("guildCollection").children].forEach(
      (guild) => {
        guild.classList.remove("selected");
      }
    );
    //add selected class to new selected guild
    document
      .querySelector('[data-guild-id="' + newGuildId + '"]')
      .classList.add("selected");
    //Change current guild name
    document.getElementById("guildName").innerHTML = newGuildName;
    //Update selected channel id
    selectedGuildId = newGuildId;
    //Update url and history
    //if(addToHistory) updateHistory();
    updateChannelList(addToHistory);

    //Hide elements that are displayed when no channel is selected
    hideEmptyScreen();
  } else {
    //Show no channel selected page
    showEmptyScreen();
  }
};

const updateHistory = () => {
  let newURL = `/app/${selectedGuildId}/${selectedChannelId}`;
  history.pushState("What I was typing before", "", newURL);
};

//Callback when user clicks back button
window.onpopstate = () => {
  //get current url, parse it, and load correct guild & channel
  selectedGuildId = getIdFromURL("guild");
  selectedChannelId = getIdFromURL("channel");
  changeGuild(selectedGuildId, false);
};

//Page shown when no channel is selected
const showEmptyScreen = () => {
  //set history to just app page
  history.pushState("", "", "/app");

  //clear out elements 
  document.getElementById("guildName").innerHTML = "";
  document.getElementById("channelName").innerHTML = "";
  document.getElementById("channelList").innerHTML = "";


  //hide text channels label
  document.getElementById("channelListLabel").classList.add("hidden");
  //show cumpus
  document.getElementById("cumpusSection").classList.remove("hidden");
  //disable input field
  document.getElementById("message-input").disabled = true;
};

const hideEmptyScreen = () => {
  //show text channels label
  document.getElementById("channelListLabel").classList.remove("hidden");
  //hide cumpus
  document.getElementById("cumpusSection").classList.add("hidden");
  //enable input field
  document.getElementById("message-input").disabled = false;
};

const showNoChannelScreen = () => {
  if (!document.getElementsByClassName("no-channel-div")[0]) {
    //create elements and append to view
    let noChannelDiv = document.createElement("div");
    noChannelDiv.classList.add("no-channel-div");

    let image = document.createElement("img");
    image.src = "/images/Cat_Compass.svg";

    let message = document.createElement("p");
    message.innerHTML = "There is no channel here";

    noChannelDiv.appendChild(image);
    noChannelDiv.appendChild(message);

    document.getElementsByClassName("chat-area")[0].appendChild(noChannelDiv);
    //disable input field
    document.getElementById("message-input").disabled = true;
  }
};

const hideNoChannelScreen = () => {
  try {
    document.getElementsByClassName("no-channel-div")[0].remove();
  } catch (e) {
    //console.log(e);
  }
  //enable input field
  document.getElementById("message-input").disabled = false;
};

//Make 3 dots icon
document.getElementById("guildSettingsBtn").innerHTML =
  "<div class='three-dots'><div></div><div></div><div></div></div>";

document.getElementById("guildSettingsBtn").addEventListener("click", () => {
  //Route to guild settings if there is a selected guild
  if(selectedGuildId) window.location.href = `/guilds/${selectedGuildId}/settings`;
});

document.getElementById("createGuildBtn").addEventListener("click", () => {
  //Route to createGuild page
  window.location.href = "/guilds/create";
});


const updateGuildDisplay = () => {
  //Clear out previous guilds
  fetch(`/api/${APIVERSION}/guilds`)
  .then((response) => response.json())
  .then((data) => {
    document.getElementById("guildCollection").innerHTML = "";
    //sort data
    data.sort((a, b) => (a.guild_id > b.guild_id ? 1 : -1));
    data.forEach(guild => {
      addGuild(guild);
    });
    //add selected class back to selected guild
    //document.querySelector('[data-guild-id="' + selectedGuildId + '"]').classList.add("selected");
    clearMessagesArea();
    changeGuild(selectedGuildId, true);
    
  });
} 

//Add guild to list of guilds. Pass in a guild object
const addGuild = (guild) => {
  let guildDiv = document.createElement("div");
  guildDiv.classList.add("guild");
  guildDiv.dataset.guildId = guild.guild_id;
  guildDiv.dataset.guildName = guild.name;
  setupTooltip(guildDiv, guildDiv.dataset.guildName);
  guildDiv.addEventListener("click", () => {
    changeGuild(guild.guild_id, true);
  });

  let imgContainer = document.createElement("div");
  imgContainer.classList.add("img-circle");

  let image = document.createElement("img");
  image.src = `/api/${APIVERSION}/icons/` + guild.icon_id;
  image.classList.add("img");

  imgContainer.appendChild(image);
  guildDiv.appendChild(imgContainer);
  document.getElementById("guildCollection").appendChild(guildDiv);
};

//Delete guild by ID
const removeGuild = (guildId) => {
  document
    .getElementById("guildCollection")
    .querySelector(`[data-guild-id='${guildId}']`)
    .remove();
};

//Show guild name on hover
const setupTooltip = (guildDiv, message) => {
  let tooltip = document.getElementById("tooltip");
  guildDiv.addEventListener("mouseover", () => {
    tooltip.style.display = "block";
    tooltip.style.left = offset(guildDiv).left + 85;
    tooltip.style.top = offset(guildDiv).top + 17;
    tooltip.innerHTML = message;
  });
  guildDiv.addEventListener("mouseout", () => {
    tooltip.style.display = "none";
  });
};

//setup tool tip for all guilds that were rendered server side
[...document.getElementById("guildCollection").children].forEach((guild) => {
  setupTooltip(guild, guild.dataset.guildName);
  guild.addEventListener("click", () => {
    changeGuild(guild.dataset.guildId, true);
  });
});

setupTooltip(document.getElementById("createGuildBtn"), "Add Guild");

//https://plainjs.com/javascript/styles/get-the-position-of-an-element-relative-to-the-document-24/
//Used to get the position of an element on the screen
const offset = (el) => {
  let rect = el.getBoundingClientRect(),
    scrollLeft = window.pageXOffset || document.documentElement.scrollLeft,
    scrollTop = window.pageYOffset || document.documentElement.scrollTop;
  return { top: rect.top + scrollTop, left: rect.left + scrollLeft };
};

//Route to user settings when click on profile
document.getElementById("currentUser").addEventListener("click", () => {
  window.location.href = `/users/${
    document.getElementById("currentUser").dataset.userId
  }/settings`;
});



//Get and store list of users
const fetchUserList = (updateSelectedGuild) => {
  fetch(`/api/${APIVERSION}/users`)
  .then((response) => response.json())
  .then((data) => {
    usersList = data;
    //get init channel list if guild is selected
    if(updateSelectedGuild) {
      if (selectedGuildId) changeGuild(selectedGuildId, true);
      else showEmptyScreen();
    }
    else{
      updateUserList();
    }
    updateDiscriminators();
  });
}

fetchUserList(true);


//Add user into usersList
const addUserToList = user => {
  usersList.push(user);
}

//Remove user from usersList
const removeUserFromList = user_id => {
  for(let i = 0; i < usersList.length; i++) {
    if(usersList[i].user_id == user_id) {
      usersList.splice(i, 1);
      break;
    }
  }
}

const updateUserDisplay = () => {
  fetchUserList(false);
}
const updateUserList = () => {
  usersList.sort((a, b) => (a.user_id > b.user_id ? 1 : -1));

  document.getElementById("userListContainer").innerHTML = "";
  for(let i = 0; i < usersList.length; i++) {
    let container = document.createElement("div");
    container.classList.add("user");
    
    let imageContainer = document.createElement("div");
    imageContainer.classList.add("icon");
    imageContainer.classList.add("img-circle");

    let image = document.createElement("img");
    image.src=`/api/${APIVERSION}/icons/` + usersList[i].icon_id;
    image.classList.add("img");
    imageContainer.appendChild(image);

    let nameContainer = document.createElement("div");
    nameContainer.classList.add("name-container");

    let name = document.createElement("p");
    name.classList.add("name");
    name.innerHTML = usersList[i].name;
    nameContainer.appendChild(name);

    let discriminator = document.createElement("p");
    discriminator.classList.add("discriminator");
    discriminator.innerHTML = `#${usersList[i].discriminator}`;
    nameContainer.appendChild(discriminator);

    container.appendChild(imageContainer);
    container.appendChild(nameContainer);

    document.getElementById("userListContainer").appendChild(container);
  }
}








let main = document.querySelector(".main");

//Displays Servers/Channels -Mobile
let serverExpanded = false;
let textChannelsList = document.querySelector(".channel-list");
let guildNameDisplay = document.querySelector(".guild-name");
let guildListDisplay = document.querySelector(".guild-list");
let serverChannelId = document.getElementById("serverChannel");
const guildsElms = [serverChannelId, guildListDisplay, guildNameDisplay, textChannelsList];

const toggleChannelsPane = () => {
	if (friendsExpanded) resetFriendsPanel();
  if (!friendsExpanded) {
    if (serverExpanded) {
      resetServerPanel();
    } else {
			openServerPanel();
    }
  }
};
serverChannelId.addEventListener("click", toggleChannelsPane);

//Displays Friends List - Mobile
let friendsExpanded = false;
let friendsList = document.querySelector(".user-list");
let prof = document.querySelector(".profile-area");
let friendsId = document.getElementById("friends");
const friendsElms = [friendsId, friendsList, prof];

const toggleFriendsPane = () => {
	if (serverExpanded) resetServerPanel();
  if (!serverExpanded) {
    if (friendsExpanded) {
      resetFriendsPanel();
    } else {
			openFriendsPanel();
    }
  }
};
friendsId.addEventListener("click", toggleFriendsPane);

//Resets mobile animations and positions if window is larger than 825 px
// changed from 850 to match the media query that sets the grid
window.addEventListener("resize", () => {
  if (document.body.clientWidth > 825) {
     serverChannelId.style.transition = "none";
    guildListDisplay.style.transition = "none";
    guildNameDisplay.style.transition = "none";
    textChannelsList.style.transition = "none";
           friendsId.style.transition = "none";
         friendsList.style.transition = "none";
                prof.style.transition = "none";

    resetServerPanel();
    resetFriendsPanel();

		setTimeout(() => {
     serverChannelId.style.transition = "";
    guildListDisplay.style.transition = "";
    guildNameDisplay.style.transition = "";
    textChannelsList.style.transition = "";
           friendsId.style.transition = "";
         friendsList.style.transition = "";
                prof.style.transition = "";
		}, 10);
  } else {
		/*
    serverChannelId.style.transition = "transform 1s ease";
    guildListDisplay.style.transition = "transform 1s ease";
    guildNameDisplay.style.transition = "transform 1s ease";
    textChannelsList.style.transition = "transform 1s ease";
    friendsId.style.transition = "transform 1s ease";
    friendsList.style.transition = "transform 1s ease";
    prof.style.transition = "transform 1s ease";
		*/
  }
});

//Resets Panels when chat or message area is clicked
document.querySelector(".chat-area").addEventListener("click", () => {
  resetFriendsPanel();
  resetServerPanel();     
})
document.querySelector(".message-area").addEventListener("click", () => {
  resetFriendsPanel();
  resetServerPanel();     
})

const openServerPanel = () => {
			for (let elm of guildsElms)
				elm.classList.add('open');
      serverExpanded = true;
};
const resetServerPanel = () => {
			for (let elm of guildsElms)
				elm.classList.remove('open');
  //serverChannelId.style.transform = "translateX(0em)";
  //guildListDisplay.style.transform = "translateX(0em)";
  //guildNameDisplay.style.transform = "translateX(0em)";
  //textChannelsList.style.transform = "translateX(0em)";
  serverExpanded = false;
}

const openFriendsPanel = () => {
	for (let elm of friendsElms)
		elm.classList.add('open');
	friendsExpanded = true;
};
const resetFriendsPanel = () => {
			for (let elm of friendsElms)
				elm.classList.remove('open');
  //friendsId.style.transform = "translateX(0em)";
  //friendsList.style.transform = "translateX(0em)";
  //prof.style.transform = "translateX(0em)";
  friendsExpanded = false;
}

//Fix discriminator display
const updateDiscriminators = () => {
  document.querySelectorAll(".discriminator").forEach((discriminator) => {
    if (discriminator.innerHTML.length < 5) {
      //remove #
      discriminator.innerHTML = discriminator.innerHTML.slice(1);
      for (let i = 0; i < 4 - discriminator.innerHTML.length; i++) {
        discriminator.innerHTML = "0" + discriminator.innerHTML;
      }
      discriminator.innerHTML = "#" + discriminator.innerHTML;
    }
  });

}
updateDiscriminators();


///////////////////////////
// swipey things
let swipeStart = {};
let swipeLast = {};

let swipeOpenStartMargin = 48; //px; how close to the edge must the swipe start to open a pane
let swipeOpenMinWidth = 32; //px; how far to the side must they swipe to open a pane
let swipeCloseMinWidth = 32; //px; how far to the side must they swipe to close a pane

const invertSwipe = (swipe) => {
	return Object.assign({}, swipe, {clientX: document.body.clientWidth - swipe.clientX});
};

const setSwipeStart = (touch) => {
	if(touch.touches) {
		swipeStart = touch.touches[0];
		setSwipeLast(touch.touches[0]);
	}
};

const setSwipeLast  = (touch) => {
	if(touch.touches) {
		swipeLast = touch.touches[0];
	}
};

const isSwipeOpenFromLeft = (start, last) => {
	const out = (
		   /*start.target != nav_toggle_btn // FIXME check that we're not tapping a button
		&&*/ start.clientX                 <= swipeOpenStartMargin
		&& last .clientX - start.clientX >= swipeOpenMinWidth
	);
	console.log('Is swipe open from left:', out);
	return out;
};

const isSwipeCloseToLeft = (start, last) => {
	const out = (
	/*swipeStart.target != nav_toggle_btn // FIXME like above
	&&*/ swipeStart.clientX - swipeLast.clientX >= swipeCloseMinWidth
	);
	console.log('Is swipe close to left:', out);
	return out;
};

const isSwipeOpenFromRight = (start, last) => {
	const out = isSwipeOpenFromLeft(invertSwipe(start), invertSwipe(last));
	console.log('Is swipe open from right:', out);
	return out;
};

const isSwipeCloseToRight  = (start, last) => {
	const out = isSwipeCloseToLeft(invertSwipe(start), invertSwipe(last));
	console.log('Is swipe open from right:', out);
	return out;
};

/*
const handleSwipeOpenFromLeft = (evt) => {
	if(isSwipeOpenFromLeft(swipeStart, swipeLast)) {
		resetFriendsPanel();
		openServerPanel();
	}
};

const handleSwipeCloseToLeft = (evt) => {
	if(isSwipeCloseToLeft(swipeStart, swipeLast) && !isSwipeOpenFromRight(swipeStart, swipeLast)) {
		resetServerPanel();
	}
};

const handleSwipeOpenFromRight = (evt) => {
	if(isSwipeOpenFromRight(swipeStart, swipeLast)) {
		resetServerPanel();
		openFriendsPanel();
	}
};

const handleSwipeCloseToRight = (evt) => {
	if(isSwipeCloseToRight(swipeStart, swipeLast) && !isSwipeOpenFromLeft(swipeStart, swipeLast)) {
		resetFriendsPanel();
	}
};
*/

const handleSwipe = (evt) => {
	const isOpenLeft = isSwipeOpenFromLeft(swipeStart, swipeLast);
	const isOpenRight = isSwipeOpenFromRight(swipeStart, swipeLast);
	const isCloseLeft = isSwipeCloseToLeft(swipeStart, swipeLast);
	const isCloseRight = isSwipeCloseToRight(swipeStart, swipeLast);
	if (isOpenRight) {
		resetServerPanel();
		openFriendsPanel();
	} else if (isOpenLeft) {
		resetFriendsPanel();
		openServerPanel();
	} else if (isCloseRight) {
		resetFriendsPanel();
	} else if (isCloseLeft) {
		resetServerPanel();
	}
};

const handleSwipes = () => {
	/*
	nav = document.getElementById('main-nav');
	nav_toggle_btn = document.getElementById('nav-btn-ctr');
	nav_toggle_btn.addEventListener('click', toggleNav);
	// if nav is open and we tap somewhere outside of it, close it
	document.addEventListener('click', (evt) => {
		if (evt.target.closest('nav#main-nav') == null || evt.target.closest('#nav-click-catcher')) closeNav();
	});
	document.addEventListener('touchstart', (evt) => {
		if (evt.target.closest('nav#main-nav') == null || evt.target.closest('#nav-click-catcher')) closeNav();
	});
	document.addEventListener('keyup', (evt) => {
		if(evt.key === 'Escape') closeNav();
	});
	*/

	document.addEventListener('touchstart', setSwipeStart);
	document.addEventListener('touchmove', setSwipeLast);
	document.addEventListener('touchmove', handleSwipe);
	/*
	document.addEventListener('touchmove', handleSwipeCloseToRight);
	document.addEventListener('touchmove', handleSwipeOpenFromRight);
	document.addEventListener('touchmove', handleSwipeCloseToLeft);
	document.addEventListener('touchmove', handleSwipeOpenFromLeft);
	*/
};

document.addEventListener('DOMContentLoaded', handleSwipes);
