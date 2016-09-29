
# Chatbot example - Cxensebot
#### Cxensebot

Cxensebot is an example implementation of a chatbot that can communicate on Slack, Facebook Messenger and on any web page, and use the full power of the CXense APIs for its responses.
Cxensebot also links the identities from the various platforms so that the system can know that the user from Slack and the user from Facebook is actualy the same user.

The example uses BotKit for the multi-platform support and wit.ai for the natural language text parsing.


##### The main program 

The main code is written in JavaScript and run in the nodejs environment.
You need nodejs v6.0.0 or later to run this example.

To install the dependencies
~~~~
npm install
~~~~

You can then run the program like this
~~~~
node cxensebot.js
~~~~


#### Running at startup

You can find a systemd startup script in the "startup-scripts" folder.
