const SLACK_BOT_TOKEN = 'YOUR_SLACK_BOT_TOKEN';
const SLACK_BOT_USER_ID = 'YOUR_SLACK_BOT_USER_ID';
const CLICKUP_API_TOKEN = 'YOUR_CLICKUP_API_TOKEN';
const CLICKUP_ENGG_TASK_LIST_ID = 'ID';


function get_call_slack(url) {
  headers = {'content-type': 'application/x-www-form-urlencoded'}; 
  const options = {'headers': headers};
  const response = UrlFetchApp.fetch(url, options);
  const result = JSON.parse(response.getContentText());
  return result;
}

function createTaskInClickUp(payload, eventRaisedFromChannel) {
  const clickup_task_list_id = CLICKUP_ENGG_TASK_LIST_ID;
  const postUrl = 'https://api.clickup.com/api/v2/list/' + clickup_task_list_id + '/task';
  const headers = {
    'content-type': 'application/json',
    'Authorization': CLICKUP_API_TOKEN
  };
  const options = {
    'method' : 'post',
    'headers' : headers,
    'payload' : JSON.stringify(payload)
  };
  const response = UrlFetchApp.fetch(postUrl, options);
  const clickupTaskUrl = JSON.parse(response.getContentText()).url;
  MailApp.sendEmail('your-email@gmail.com', 'Track Usability Issues bot', 'Created task in clickup: \n' + clickupTaskUrl);
  return clickupTaskUrl;
}

function postMessageOnSlackThread(clickupTaskUrl, thread_ts, channel) {
  const url = 'https://slack.com/api/chat.postMessage?token=' + SLACK_BOT_TOKEN + '&channel=' + channel + '&thread_ts='+ thread_ts + '&text=' + clickupTaskUrl;
  const headers = {
    'content-type': 'application/x-www-form-urlencoded'
  };
  const options = {
    'method' : 'post',
    'headers' : headers
  };
  const response = UrlFetchApp.fetch(url, options);
}

function getSlackMessagePermalink(ts, channel) {
  const url = 'https://slack.com/api/chat.getPermalink?token=' + SLACK_BOT_TOKEN + '&channel=' + channel + '&message_ts=' + ts;
  const response = get_call_slack(url);
  return response.permalink;
}

function parseThreadMessageAndRetrieveParentMessage(ts, text, channel) {
  var taskTitle = text.split('<@' + SLACK_BOT_USER_ID + '>').join('').trim();
  taskTitle = taskTitle.length > 0 ? taskTitle : 'Usability Issue #' + ts.split('.').join('');
  const regEx = /\&lt;([^)]+)\&gt;/;
  var rawTagsHtmlText = null;
  var tags = null;
  try {
    rawTagsHtmlText = regEx.exec(text)[0].split(',');
    tags = regEx.exec(text)[1].split(',');
  } catch (e) {
    if ( e instanceof TypeError ) {
      rawTagsHtmlText = null;
      tags = null;
    }
  }
  const conversation_url = 'https://slack.com/api/conversations.history?token=' + SLACK_BOT_TOKEN + '&channel=' + channel + '&latest=' + ts + '&inclusive=true&limit=1';
  const message = get_call_slack(conversation_url);
  let parsedSlackMessage = '';
  const slackMessageElements = message.messages[0].blocks[0].elements[0].elements;
  for (let i = 0; i < slackMessageElements.length; i++) {
    parsedSlackMessage += slackMessageElements[i].text ? slackMessageElements[i].text : slackMessageElements[i].url;
  }
  const task_description = 'Issue Description:-\n' + parsedSlackMessage + '\n\nSlack message link: ' + getSlackMessagePermalink(ts, channel);
  var payload = {};
  if (tags != null) {
    taskTitle = taskTitle.replace(rawTagsHtmlText, '');
    payload['tags'] = tags;
  }
  payload['name'] = taskTitle;
  payload['markdown_content'] = task_description;
  return payload;
}

function doPost(e) {
  // Parse slack message thread_ts(id) and text from the payload
  const thread_ts = JSON.parse(e.postData.contents).event.thread_ts;
  const text = JSON.parse(e.postData.contents).event.text;
  const eventRaisedFromChannel = JSON.parse(e.postData.contents).event.channel;
  const issue_message = parseThreadMessageAndRetrieveParentMessage(thread_ts, text, eventRaisedFromChannel);
  const clickupTaskUrl = createTaskInClickUp(issue_message, eventRaisedFromChannel);
  postMessageOnSlackThread(clickupTaskUrl, thread_ts, eventRaisedFromChannel);
}
