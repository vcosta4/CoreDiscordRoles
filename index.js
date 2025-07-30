// Emoji-to-role logic for Discord role assignment bot
const { Client, GatewayIntentBits, Partials } = require("discord.js");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent, // Only if needed
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildMembers, // REQUIRED for assigning roles
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction],
});

// Emoji maps for each question
const whoMap = {
  "🧍": "Player",
  "🧑‍🧑‍🧒": "Parent",
};

const ageMap = {
  "2️⃣": "12",
  "3️⃣": "13",
  "4️⃣": "14",
  "5️⃣": "15",
  "6️⃣": "16",
  "7️⃣": "17",
  "8️⃣": "18",
};

const levelMap = {
  "🇵": "Platinum",
  "🇹": "Titanium",
};

const genderMap = {
  "👧": "Girls",
  "👦": "Boys",
};

const selections = new Map();
printSelections();

// Replace these with the actual message IDs
const WHO_MESSAGE_ID = "1400169681649795223";
const AGE_MESSAGE_ID = "1400170255992754246";
const LEVEL_MESSAGE_ID = "1400170987227447336";
const GENDER_MESSAGE_ID = "1400171150855901267";

async function printSelections() {
  console.log("Current selections:");
  if (selections.size === 0) {
    console.log("No selections found.");
    return;
  }

  for (const [userId, userData] of selections.entries()) {
    try {
      const user = await client.users.fetch(userId);
      const username = user.username;
      const { who, age, level, gender, roleAssigned } = userData;

      console.log(`User: ${username}`);
      console.log(`  Who: ${who || "Not selected"}`);
      console.log(`  Age: ${age || "Not selected"}`);
      console.log(`  Level: ${level || "Not selected"}`);
      console.log(`  Gender: ${gender || "Not selected"}`);
      console.log(`  Role Assigned: ${roleAssigned || "None"}`);
      console.log("---");
    } catch (error) {
      console.log(`User ID: ${userId} (Could not fetch username)`);
      const { who, age, level, gender, roleAssigned } = userData;
      console.log(`  Who: ${who || "Not selected"}`);
      console.log(`  Age: ${age || "Not selected"}`);
      console.log(`  Level: ${level || "Not selected"}`);
      console.log(`  Gender: ${gender || "Not selected"}`);
      console.log(`  Role Assigned: ${roleAssigned || "None"}`);
      console.log("---");
    }
  }
}

function getSelectionType(messageId) {
  if (messageId === WHO_MESSAGE_ID) return "who";
  if (messageId === AGE_MESSAGE_ID) return "age";
  if (messageId === LEVEL_MESSAGE_ID) return "level";
  if (messageId === GENDER_MESSAGE_ID) return "gender";
  return null;
}

function getEmojiMap(type) {
  switch (type) {
    case "who":
      return whoMap;
    case "age":
      return ageMap;
    case "level":
      return levelMap;
    case "gender":
      return genderMap;
    default:
      return {};
  }
}

// Handle reaction addition
client.on("messageReactionAdd", async (reaction, user) => {
  if (user.bot) return;
  if (reaction.partial) await reaction.fetch();
  if (reaction.message.partial) await reaction.message.fetch();

  // Get message type
  const { message, emoji } = reaction;
  const type = getSelectionType(message.id);
  if (!type) return;

  // Get emoji
  const emojiMap = getEmojiMap(type);
  const value = emojiMap[emoji.name];
  console.log(
    `${user.username} added reaction \"${value}\" to ${type.toUpperCase()} MESSAGE.`,
  );
  console.log(`---`);
  if (!value) return;

  const member = await message.guild.members.fetch(user.id);
  const userData = selections.get(user.id) || {
    who: null,
    age: null,
    level: null,
    gender: null,
    roleAssigned: null,
  };

  // Remove other reactions from the same message
  const userReactions = [];
  for (const reaction of message.reactions.cache.values()) {
    // Make sure we have full reaction data
    if (reaction.partial) await reaction.fetch();
    try {
      const users = await reaction.users.fetch(); // fetch all users who reacted
      if (users.has(user.id)) {
        userReactions.push(reaction);
      }
    } catch (err) {
      console.error(
        `Error fetching users for reaction ${reaction.emoji.name}:`,
        err,
      );
    }
  }
  // Now iterate
  for (const r of userReactions) {
    if (r.emoji.name !== emoji.name) {
      await r.users.remove(user.id);
      console.log(
        `Bot removed reaction \"${r.emoji.name}\" to ${type.toUpperCase()} MESSAGE for ${user.username}.`,
      );
      console.log(`---`);
    }
  }

  userData[type] = value;
  const { who, age, level, gender } = userData;

  if (who && age && level && gender) {
    const newRoleName = `${who} - ${age} ${level} ${gender}`;
    console.log(`New Role: ${newRoleName}, User: ${user.username}`);
    console.log(`---`);
    if (userData.roleAssigned !== newRoleName) {
      if (userData.roleAssigned) {
        const oldRole = message.guild.roles.cache.find(
          (role) => role.name === userData.roleAssigned,
        );
        if (oldRole) await member.roles.remove(oldRole).catch(console.error);
      }
      const newRole = message.guild.roles.cache.find(
        (role) => role.name === newRoleName,
      );
      if (newRole) await member.roles.add(newRole).catch(console.error);
      userData.roleAssigned = newRoleName;
    }
  }

  selections.set(user.id, userData);
  printSelections();
});

// Handle reaction removal
client.on("messageReactionRemove", async (reaction, user) => {
  if (user.bot) return;
  if (reaction.partial) await reaction.fetch();
  if (reaction.message.partial) await reaction.message.fetch();
  const { message, emoji } = reaction;

  // Get message type
  const type = getSelectionType(message.id);
  if (!type) return;

  // Get emoji
  const emojiMap = getEmojiMap(type);
  const value = emojiMap[emoji.name];
  console.log(
    `${user.username} or BOT removed reaction \"${value}\" to ${type.toUpperCase()} MESSAGE.`,
  );
  console.log(`---`);
  if (!value) return;

  const member = await message.guild.members.fetch(user.id);
  const userData = selections.get(user.id);
  if (!userData) return;

  // Remove the reaction from the user's data
  if (userData[type] === value) {
    userData[type] = null;
  }

  // Remove the role if any selections are null
  if (userData.roleAssigned) {
    const oldRole = message.guild.roles.cache.find(
      (role) => role.name === userData.roleAssigned,
    );
    if (oldRole) await member.roles.remove(oldRole).catch(console.error);
    userData.roleAssigned = null;
  }

  selections.set(user.id, userData);
  printSelections();
});

client.once("ready", () => {
  console.log(`Bot ready: ${client.user.tag}`);
});

client.login(process.env.TOKEN);
