'use strict';

/* Return a new shuffled array */

Object.defineProperties(Array.prototype, {
  "shuffled": { enumberable: true, value: function() {
    var shuffled = new Array();
    var shuffle = this.slice(0);
    while (shuffle.length > 0) {
      var index = Math.floor(Math.random() * shuffle.length);
      shuffled.push(shuffle.splice(index, 1)[0]);
    }
    return shuffled;
  }}
});

/* Our card */

function Card(reading, spelling, family, level, available) {
  this.reading = reading;
  this.spelling = spelling;
  this.family = family;
  this.level = level || 0;
  this.available = available || false;
}

Object.defineProperties(Card, {
  "clone": { enumberable: true, value: function(c) {
    return new Card(c.reading, c.spelling, c.family, c.level, c.available);
  }}
});

/* Our question */

function Question(spelling, answers) {
  this.spelling = spelling || '';
  this.answers = answers || [];
}

/* Our game progress */

function Progress($scope) {
  this.$scope = $scope;
  this.cards = new Array();
  this.readings = new Object();
  this.available = new Array();
  this.session = -1;

  var json = localStorage.getItem('progress');
  if (json != null) try {
    console.log("Restoring previous session");
    var progress = JSON.parse(json);
    this.load(progress.cards);
    this.session = progress.session;
  } catch (error) {
    console.log("Error parsing JSON", error);
    this.cards = new Array();
    this.session = -1;
  }
};

Object.defineProperties(Progress.prototype, {

  /* Load cards in our progress */

  "clear": { enumberable: true, value: function() {
    this.cards = new Array();
    this.readings = new Object();
    this.available = new Array();
    this.session = -1;
    return this;
  }},

  /* Load cards in our progress */

  "load": { enumberable: true, value: function(cards) {
    for (var index = 0; index < cards.length; index ++) {

      /* Clone the card */
      var card = Card.clone(cards[index]);

      /* Keep the cloned card */
      this.cards.push(card);

      /* If marked as "available" keep it in the current session */
      if (card.available) this.available.push(card);

      /* Store the reading in the appropriate family */
      if (this.readings[card.family] == null) {
        this.readings[card.family] = new Array();
      }
      this.readings[card.family].push(card.reading);
    }

    /* Return "this" progress */
    return this;
  }},

  /* The "current" element (ahead of the queue) */

  "status": { enumberable: true, value: function(level) {
    var count = 0;
    for (var index in this.cards) {
      if (this.cards[index].level == level) {
        count ++;
      }
    }
    return count;
  }},

  /* The next element (ahead of the queue) */

  "question": { enumberable: true, value: function() {

    /* End of session, start a new one */
    if (this.available.length == 0) {

      /* End game? Restart! */
      if (this.session == 5) {
        for (var index in this.cards) {
          this.cards[index].level = 0;
        }
      }

      this.session = (this.session + 1) % 5;
      console.log("Re-shuffling cards for session " + this.session);

      /* Add all the cards with level lower than the current session */
      for (var index in this.cards) {
        var card = this.cards[index];
        if (card.level <= this.session) {
          card.available = true;
          this.available.push(card);
        }
      }
      /* Shuffle the cards */
      this.cards = this.cards.shuffled();
    }

    /* All done? */
    if (this.available.length == 0) {
      /* If we're not at level 4, retry */
      if (this.session < 4) return this.question();
      this.session = 5;
      console.log("All done!");
      return new Question();
    }

    /* The "current" card is at the head of our queue */
    var card = this.available[0];

    /* Fill in answers if never seen before */
    var readings = this.readings[card.family];
    var answers = new Array();
    answers.push(card.reading);
    while (answers.length < 3) {
      var answer = readings[Math.floor(Math.random() * readings.length)];
      if (answers.indexOf(answer) < 0) answers.push(answer);
    }

    /* Return the card and answers */
    return new Question(card.spelling, answers.shuffled());
  }},

  "answer": { enumberable: true, value: function(response) {
    console.log("Response is '" + response + "'");
    if (response == null) {
      this.$scope.class = '';
      this.$scope.current = this.question();
      return;
    }

    /* Get the current card and remove from availables */
    var card = this.available.splice(0, 1)[0];
    if (card == null) return new Question();

    /* This card is not available anymore (until next session) */
    card.available = false;

    /* Figure out if this is the correct answer */
    if (response == card.reading) {
      console.log("Correct response '" + response + "' for '" + card.reading + "'", card);
      ga('send', 'event', 'response', 'correct');
      this.$scope.class = 'success';
      if (card.level < 5) card.level ++;

    } else {
      console.log("Wrong response '" + response + "' for '" + card.reading + "'", card);
      ga('send', 'event', 'response', 'wrong');
      this.$scope.class = 'failure';
      if (card.level > 0) card.level --;
    }

    /* Store our newly defined state */
    localStorage.setItem('progress', JSON.stringify({
      'cards': this.cards,
      'session': this.session
    }));

    /* Process the next question */
    var question = this.question();
    var $scope = this.$scope;
    window.setTimeout(function() {
      $scope.current = question;
      $scope.class = '';
      $scope.$apply();
    }, 300);
  }},

});

/* ========================================================== */

var _progress = null;
var _options = null;

(function(){

  /* Our application and dependencies */
  angular.module('JapaneseApp', [])
    .controller('JapaneseController', ['$scope', function($scope) {
      console.debug('Initializing application "JapaneseApp"');

      /* Get or create our "Progress" object */
      var progress = new Progress($scope);
      if (progress.session < 0) progress.load(hiragana.shuffled());

      /* Instrument our scope */
      $scope['progress'] = progress;
      $scope['current'] = progress.question();
      $scope['show_menu'] = false;
      $scope['katakana'] = false;
      $scope['hiragana'] = true;

      /* Restart function */
      $scope['restart'] = function() {
        ga('send', 'event', 'restart', 'restart');
        var progress = new Progress($scope).clear();
        if ($scope['hiragana']) progress.load(hiragana.shuffled());
        if ($scope['katakana']) progress.load(katakana.shuffled());
        $scope['current'] = progress.question();
        $scope['progress'] = progress;
        $scope['show_menu'] = false;
        _progress = $scope['progress'];
      }
      _progress = $scope['progress'];
    }]);
}());
