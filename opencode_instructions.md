Let's look at new3.html. I want to make it look better on desktop screens. 
Let's create new4.html that will:
- put the title to the left column
- put the language chooser dropdown to the left column
- counter and reshuffle button to the left
- rename the breshuffle button to "jeszcze raz!"

Let's handle language choosing via url params. Something like: new4.html?lang=en or new4.html?lang=pl. We will read the lang param and set the dropdown accordingly.

After choosing the language mnually, update the url to reflect the chosen language. This way, if the user refreshes the page, the chosen language will persist.

Now something complex. I want an algorithm that solves the board and lists all words that could be found in the board. I have some previous work in boggle_pl_js folder. There are 2 js files with algorithms, that version is for the terminal, let's add this functinality to the HTML. after the time of the game finishes, I want words to be shown in the right column, sorted down from longest to shortest. 

Now, let's add the background stored in bg.png.

Once the dictionary fetching is ready, show a button "A pokaż" that displays the words immediately.

Look at this error.

Access to fetch at 'file:///home/bartek/priv/oggle/boggle_pl_js/pl_sjp.pl.txt' from origin 'null' has been blocked by CORS policy: Cross origin requests are only supported for protocol schemes: brave, chrome, chrome-extension, chrome-untrusted, data, http, https, isolated-app.

I am fine with changing the format of the file, it can be a js file, or maybe you can create some trie-compatible version. SOmething that loads fast and is allowed by browsers.

When there is 15 seconds start pulsating the color of the dice, go from current yellow to red and back to yellow, rather fast, like every 2 seconds. 

Now, let's implement a heatmap. WHen the found word list shows, I want each letter to be marked by how frequent it was used. If the letter was used the most the color is dark yellow, when it was never used it stays the same. And all the shades in between. The letters need a black thin outline now so they stay visible. 

Now, after the wordlist show, when I hover on a letter, mark all the words that used that letter.

Now, when I hover on the word on the wordlist, show which dice were used to make it. 

Make the timer configurable by url param, like &t=180.

Now, add a little plus and minus buttons, small, below the timer that add or subtract a minute, when clicked, update the url too. 
    
Translate this text to Polish and put in bottom left corner.

    This is a board for a game of <a href="https://en.wikipedia.org/wiki/Boggle">Boggle</a>.
    It only displays the board, you will need pencil and paper and a bunch of friends to play,
    this is not an on-line game.

Also, add a sentence in Polish explaining the rules, in shortest possible way. 

Add this to the text: "Tylko słowa pisane z małej litery". 


Now, let's try to add wordlists for other languages. I don't have them. Can you suggest where I can find such wordlists, as complete as possible for spanish, russian, english?