chrome.action.onClicked.addListener((tab) => {
  chrome.scripting
    .executeScript({
      target: { tabId: tab.id },
      files: ["content.js"],
    })
    .catch((err) => console.error("Injection failed:", err));
});

console.log("loaded");

//hit highlights API and retrieve;
// background script
chrome.runtime.onMessage.addListener(
  function (message, sender, senderResponse) {
    if (message.type === "get_highlights") {
      params = {
        url: message.url,
      };
      const url = new URL("http://localhost:3000/highlights");
      url.search = new URLSearchParams(params).toString();
      // accepts URL object in modern fetch
      fetch(url, {
        method: "GET",
      })
        .then((response) => {
          // Check if the request was successful
          if (!response.ok) {
            throw new Error("Network response was not ok");
          }
          console.log(response);
          return response.json(); // Parse the JSON data from the response
        })
        .then((data) => senderResponse({ highlights: data }))
        .catch((err) => senderResponse({ error: err.message }));
    }
    return true;
  },
);
//add highlights
chrome.runtime.onMessage.addListener(
  function (message, sender, senderResponse) {
    if (message.type === "add_highlights") {
      const url = new URL("http://localhost:3000/addhighlight");
      // accepts URL object in modern fetch
      fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: message.url,
          text: message.text,
          tag: message.tag,
          text_tag_pairs: message.text_tag_pairs,
        }),
      })
        .then((response) => {
          // Check if the request was successful
          if (!response.ok) {
            throw new Error("Network response was not ok");
          }
          console.log(response);
          return response.json(); // Parse the JSON data from the response
        })
        .then((data) => senderResponse({ highlight: data }))
        .catch((err) => senderResponse({ error: err.message }));
    }
    return true;
  },
);

//update highlights

//edit or delete highlights

//future login?
