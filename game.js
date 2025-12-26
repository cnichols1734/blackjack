// Pixel Blackjack - Professional Edition
class BlackjackGame {
    constructor() {
        this.deck = [];
        this.playerHand = [];
        this.dealerHand = [];
        this.playerValue = 0;
        this.dealerValue = 0;
        this.balance = 1000;
        this.currentBet = 0;
        this.previousBet = 0;
        this.gamesPlayed = 0;
        this.wins = 0;
        this.gameInProgress = false;
        this.playerStood = false;
        this.dealerCardHidden = false;

        // Card suits and values
        this.suits = ['♠', '♥', '♦', '♣'];
        this.values = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

        // DOM elements
        this.balanceEl = document.getElementById('balance');
        this.gamesPlayedEl = document.getElementById('games-played');
        this.winsEl = document.getElementById('wins');
        this.messageEl = document.getElementById('game-message');
        this.betDisplayEl = document.getElementById('current-bet');
        this.playerHandEl = document.getElementById('player-hand');
        this.dealerHandEl = document.getElementById('dealer-hand');
        this.playerValueEl = document.getElementById('player-value');
        this.dealerValueEl = document.getElementById('dealer-value');
        this.gameControlsEl = document.getElementById('game-controls');
        this.hitBtn = document.getElementById('hit');
        this.standBtn = document.getElementById('stand');
        this.doubleBtn = document.getElementById('double');

        this.init();
    }

    init() {
        this.setupEventListeners();
        this.updateDisplay();
        this.showMessage('Place your bet to start!');
    }

    setupEventListeners() {
        // Chip buttons
        document.querySelectorAll('.chip').forEach(chip => {
            chip.addEventListener('click', () => this.addBet(parseInt(chip.dataset.value)));
        });

        // Control buttons
        document.getElementById('clear-bet').addEventListener('click', () => this.clearBet());
        document.getElementById('rebet').addEventListener('click', () => this.rebet());
        document.getElementById('max-bet').addEventListener('click', () => this.maxBet());
        document.getElementById('deal').addEventListener('click', () => this.deal());
        document.getElementById('hit').addEventListener('click', () => this.hit());
        document.getElementById('stand').addEventListener('click', () => this.stand());
        document.getElementById('double').addEventListener('click', () => this.doubleDown());

        // Rules toggle
        document.getElementById('toggle-rules').addEventListener('click', () => {
            const rulesPanel = document.getElementById('rules-panel');
            rulesPanel.style.display = rulesPanel.style.display === 'none' ? 'block' : 'none';
        });
    }

    createDeck() {
        this.deck = [];
        for (const suit of this.suits) {
            for (const value of this.values) {
                this.deck.push({
                    suit: suit,
                    value: value,
                    isRed: suit === '♥' || suit === '♦'
                });
            }
        }
        this.shuffleDeck();
    }

    shuffleDeck() {
        for (let i = this.deck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.deck[i], this.deck[j]] = [this.deck[j], this.deck[i]];
        }
    }

    getCardValue(card) {
        if (['J', 'Q', 'K'].includes(card.value)) return 10;
        if (card.value === 'A') return 11;
        return parseInt(card.value);
    }

    calculateHandValue(hand) {
        let value = 0;
        let aces = 0;

        for (const card of hand) {
            if (card.value === 'A') {
                aces++;
                value += 11;
            } else if (['J', 'Q', 'K'].includes(card.value)) {
                value += 10;
            } else {
                value += parseInt(card.value);
            }
        }

        // Handle aces (soft 17)
        while (value > 21 && aces > 0) {
            value -= 10;
            aces--;
        }

        return value;
    }

    createCardElement(card, hidden = false) {
        const cardEl = document.createElement('div');
        cardEl.className = `card ${card.isRed ? 'red' : 'black'}`;

        if (hidden) {
            cardEl.innerHTML = `
                <div class="card-back"></div>
            `;
            cardEl.classList.add('hidden-card');
        } else {
            cardEl.innerHTML = `
                <div class="card-value">${card.value}</div>
                <div class="card-suit">${card.suit}</div>
            `;
        }

        return cardEl;
    }

    dealCard(hand, container, hidden = false) {
        if (this.deck.length === 0) {
            this.createDeck();
        }

        const card = this.deck.pop();
        hand.push(card);

        const cardEl = this.createCardElement(card, hidden);
        container.appendChild(cardEl);

        // Add dealing animation
        setTimeout(() => {
            cardEl.classList.add('visible', 'dealing');
        }, 100);

        return card;
    }

    clearHands() {
        this.playerHand = [];
        this.dealerHand = [];
        this.playerValue = 0;
        this.dealerValue = 0;
        this.playerStood = false;
        this.dealerCardHidden = false;

        this.playerHandEl.innerHTML = '';
        this.dealerHandEl.innerHTML = '';
        this.updateHandValues();
    }

    updateHandValues() {
        this.playerValue = this.calculateHandValue(this.playerHand);
        this.dealerValue = this.calculateHandValue(this.dealerHand);

        this.playerValueEl.textContent = this.playerValue;
        
        // Only show the first card's value when dealer has a hidden card
        if (this.dealerCardHidden && this.dealerHand.length >= 1) {
            const visibleValue = this.calculateHandValue([this.dealerHand[0]]);
            this.dealerValueEl.textContent = visibleValue;
        } else {
            this.dealerValueEl.textContent = this.dealerValue;
        }
    }

    addBet(amount) {
        if (this.gameInProgress) return;

        if (this.balance >= amount) {
            this.currentBet += amount;
            this.balance -= amount;
            this.updateDisplay();
            this.showMessage(`Bet: $${this.currentBet}`);
        } else {
            this.showMessage('Not enough balance!');
        }
    }

    clearBet() {
        if (this.gameInProgress) return;

        this.balance += this.currentBet;
        this.currentBet = 0;
        this.updateDisplay();
        this.showMessage('Place your bet to start!');
    }

    rebet() {
        if (this.gameInProgress) return;
        
        if (this.previousBet === 0) {
            this.showMessage('No previous bet!');
            return;
        }

        // Return current bet to balance first
        this.balance += this.currentBet;
        this.currentBet = 0;

        // Place previous bet amount (or max available)
        const betAmount = Math.min(this.previousBet, this.balance);
        if (betAmount > 0) {
            this.currentBet = betAmount;
            this.balance -= betAmount;
            this.updateDisplay();
            this.showMessage(`Bet: $${this.currentBet}`);
        } else {
            this.showMessage('Not enough balance!');
        }
    }

    maxBet() {
        if (this.gameInProgress) return;
        
        // Add all remaining balance to current bet
        if (this.balance > 0) {
            this.currentBet += this.balance;
            this.balance = 0;
            this.updateDisplay();
            this.showMessage(`MAX BET: $${this.currentBet}`);
        } else if (this.currentBet > 0) {
            this.showMessage(`Already bet: $${this.currentBet}`);
        } else {
            this.showMessage('No funds available!');
        }
    }

    deal() {
        if (this.currentBet === 0) {
            this.showMessage('Place a bet first!');
            return;
        }

        if (this.gameInProgress) return;

        // Save current bet as previous bet for rebet feature
        this.previousBet = this.currentBet;
        
        this.gameInProgress = true;
        this.gamesPlayed++;
        this.clearHands();
        this.createDeck();

        // Deal initial cards
        setTimeout(() => this.dealCard(this.playerHand, this.playerHandEl), 200);
        setTimeout(() => this.dealCard(this.dealerHand, this.dealerHandEl), 600);
        setTimeout(() => this.dealCard(this.playerHand, this.playerHandEl), 1000);
        setTimeout(() => {
            this.dealCard(this.dealerHand, this.dealerHandEl, true);
            this.dealerCardHidden = true;
        }, 1400);

        setTimeout(() => {
            this.updateHandValues();
            this.checkInitialBlackjack();
            this.showGameControls();
        }, 1600);
    }

    checkInitialBlackjack() {
        const playerBJ = this.playerValue === 21 && this.playerHand.length === 2;
        const dealerBJ = this.dealerValue === 21 && this.dealerHand.length === 2;

        if (playerBJ && dealerBJ) {
            this.revealDealerCard();
            this.showMessage('PUSH! Both have Blackjack');
            this.endGame('push');
        } else if (playerBJ) {
            this.revealDealerCard();
            this.showMessage('BLACKJACK! You win!');
            this.endGame('blackjack');
        } else if (dealerBJ) {
            this.revealDealerCard();
            this.showMessage('Dealer has Blackjack!');
            this.endGame('lose');
        }
    }

    revealDealerCard() {
        this.dealerCardHidden = false;
        const dealerCards = this.dealerHandEl.querySelectorAll('.card');
        if (dealerCards.length > 1) {
            const secondCard = dealerCards[1];
            const hiddenCard = this.dealerHand[1];
            secondCard.innerHTML = `
                <div class="card-value">${hiddenCard.value}</div>
                <div class="card-suit">${hiddenCard.suit}</div>
            `;
            secondCard.classList.remove('hidden-card');
            secondCard.classList.add(hiddenCard.isRed ? 'red' : 'black');
        }
        this.updateHandValues();
    }

    hit() {
        if (!this.gameInProgress) return;

        this.dealCard(this.playerHand, this.playerHandEl);
        this.updateHandValues();

        if (this.playerValue > 21) {
            this.showMessage('BUST! You lose!');
            this.endGame('lose');
        } else if (this.playerValue === 21) {
            this.stand();
        }
    }

    stand() {
        if (!this.gameInProgress) return;

        this.playerStood = true;
        this.revealDealerCard();
        this.playDealer();
    }

    doubleDown() {
        if (!this.gameInProgress || this.playerHand.length !== 2) return;

        if (this.balance >= this.currentBet) {
            this.balance -= this.currentBet;
            this.currentBet *= 2;
            this.updateDisplay();

            this.dealCard(this.playerHand, this.playerHandEl);
            this.updateHandValues();

            if (this.playerValue > 21) {
                this.showMessage('BUST! You lose!');
                this.endGame('lose');
            } else {
                this.stand();
            }
        } else {
            this.showMessage('Not enough balance to double!');
        }
    }

    playDealer() {
        // Recalculate dealer value fresh to avoid any stale data
        this.dealerValue = this.calculateHandValue(this.dealerHand);
        this.dealerValueEl.textContent = this.dealerValue;

        const dealerPlay = () => {
            // Recalculate each time to ensure accuracy
            const currentDealerValue = this.calculateHandValue(this.dealerHand);
            this.dealerValue = currentDealerValue;
            this.dealerValueEl.textContent = currentDealerValue;
            
            // Dealer must stand on 17 or higher
            if (currentDealerValue >= 17) {
                // Dealer stands on 17+
                this.determineWinner();
            } else {
                // Dealer hits on 16 or less
                setTimeout(() => {
                    this.dealCard(this.dealerHand, this.dealerHandEl);
                    setTimeout(dealerPlay, 800);
                }, 500);
            }
        };

        // Start dealer play after a short delay
        setTimeout(dealerPlay, 300);
    }

    determineWinner() {
        const playerValue = this.playerValue;
        const dealerValue = this.dealerValue;

        if (dealerValue > 21) {
            this.showMessage('Dealer busts! You win!');
            this.endGame('win');
        } else if (playerValue > dealerValue) {
            this.showMessage('You win!');
            this.endGame('win');
        } else if (dealerValue > playerValue) {
            this.showMessage('Dealer wins!');
            this.endGame('lose');
        } else {
            this.showMessage('PUSH!');
            this.endGame('push');
        }
    }

    endGame(result) {
        this.gameInProgress = false;
        this.hideGameControls();

        let payout = 0;
        switch (result) {
            case 'win':
                payout = this.currentBet * 2;
                this.balance += payout;
                this.wins++;
                break;
            case 'blackjack':
                payout = Math.floor(this.currentBet * 2.5);
                this.balance += payout;
                this.wins++;
                break;
            case 'push':
                payout = this.currentBet;
                this.balance += payout;
                break;
            case 'lose':
                payout = 0;
                break;
        }

        this.currentBet = 0;
        this.updateDisplay();

        // Add visual effects
        if (result === 'win' || result === 'blackjack') {
            document.querySelector('.game-container').classList.add('win-glow');
            setTimeout(() => {
                document.querySelector('.game-container').classList.remove('win-glow');
            }, 2000);
        } else if (result === 'lose') {
            document.querySelector('.game-container').classList.add('lose-shake');
            setTimeout(() => {
                document.querySelector('.game-container').classList.remove('lose-shake');
            }, 500);
        }

        // Auto-clear after delay
        setTimeout(() => {
            this.showMessage('Place your bet to play again!');
        }, 3000);
    }

    showGameControls() {
        this.gameControlsEl.style.display = 'flex';

        // Show double down option only on first two cards
        if (this.playerHand.length === 2 && this.balance >= this.currentBet) {
            this.doubleBtn.style.display = 'inline-block';
        } else {
            this.doubleBtn.style.display = 'none';
        }
    }

    hideGameControls() {
        this.gameControlsEl.style.display = 'none';
    }

    showMessage(message) {
        this.messageEl.textContent = message.toUpperCase();
    }

    updateDisplay() {
        this.balanceEl.textContent = this.balance;
        this.gamesPlayedEl.textContent = this.gamesPlayed;
        this.winsEl.textContent = this.wins;
        this.betDisplayEl.textContent = `BET: $${this.currentBet}`;
    }
}

// Initialize the game when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new BlackjackGame();
});
