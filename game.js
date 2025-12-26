// Pixel Blackjack - Professional Edition with Supabase Auth

// ═══════════════════════════════════════════════════════════════════════════
// SUPABASE CLIENT
// ═══════════════════════════════════════════════════════════════════════════

// Supabase client - initialized after DOM loads
let supabase = null;

function initSupabase() {
    // The CDN exposes supabase on window
    if (window.supabase && window.supabase.createClient) {
        supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        return true;
    }
    console.error('Supabase SDK not loaded');
    return false;
}

// ═══════════════════════════════════════════════════════════════════════════
// AUTH MANAGER
// ═══════════════════════════════════════════════════════════════════════════

class AuthManager {
    constructor() {
        this.user = null;
        this.isGuest = false;
        this.userStats = null;
        
        // DOM Elements
        this.authScreen = document.getElementById('auth-screen');
        this.gameContainer = document.getElementById('game-container');
        this.signinForm = document.getElementById('signin-form');
        this.signupForm = document.getElementById('signup-form');
        this.signinTab = document.getElementById('signin-tab');
        this.signupTab = document.getElementById('signup-tab');
        this.authError = document.getElementById('auth-error');
        this.guestBtn = document.getElementById('guest-btn');
        this.logoutBtn = document.getElementById('logout-btn');
        this.userNameEl = document.getElementById('user-name');
        
        this.init();
    }
    
    async init() {
        this.setupEventListeners();
        await this.checkExistingSession();
    }
    
    setupEventListeners() {
        // Tab switching
        this.signinTab.addEventListener('click', () => this.switchTab('signin'));
        this.signupTab.addEventListener('click', () => this.switchTab('signup'));
        
        // Form submissions
        this.signinForm.addEventListener('submit', (e) => this.handleSignIn(e));
        this.signupForm.addEventListener('submit', (e) => this.handleSignUp(e));
        
        // Guest mode
        this.guestBtn.addEventListener('click', () => this.playAsGuest());
        
        // Logout
        this.logoutBtn.addEventListener('click', () => this.handleLogout());
    }
    
    switchTab(tab) {
        this.authError.textContent = '';
        
        if (tab === 'signin') {
            this.signinTab.classList.add('active');
            this.signupTab.classList.remove('active');
            this.signinForm.classList.remove('hidden');
            this.signupForm.classList.add('hidden');
        } else {
            this.signupTab.classList.add('active');
            this.signinTab.classList.remove('active');
            this.signupForm.classList.remove('hidden');
            this.signinForm.classList.add('hidden');
        }
    }
    
    async checkExistingSession() {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            
            if (session) {
                this.user = session.user;
                await this.loadUserStats();
                this.showGame();
            }
        } catch (error) {
            console.error('Session check error:', error);
        }
    }
    
    async handleSignIn(e) {
        e.preventDefault();
        this.authError.textContent = '';
        
        const email = document.getElementById('signin-email').value;
        const password = document.getElementById('signin-password').value;
        
        try {
            const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password
            });
            
            if (error) throw error;
            
            this.user = data.user;
            await this.loadUserStats();
            this.showGame();
            
        } catch (error) {
            this.authError.textContent = error.message || 'Sign in failed';
        }
    }
    
    async handleSignUp(e) {
        e.preventDefault();
        this.authError.textContent = '';
        
        const displayName = document.getElementById('signup-name').value;
        const email = document.getElementById('signup-email').value;
        const password = document.getElementById('signup-password').value;
        
        try {
            const { data, error } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        display_name: displayName
                    }
                }
            });
            
            if (error) throw error;
            
            // Check if email confirmation is required
            if (data.user && !data.session) {
                this.authError.style.color = '#4ade80';
                this.authError.textContent = 'Check your email to confirm your account!';
                return;
            }
            
            this.user = data.user;
            await this.createUserStats(displayName, email);
            this.showGame();
            
        } catch (error) {
            this.authError.textContent = error.message || 'Sign up failed';
        }
    }
    
    async createUserStats(displayName, email) {
        try {
            const { error } = await supabase
                .from('user_stats')
                .insert({
                    id: this.user.id,
                    email: email,
                    display_name: displayName,
                    balance: 1000,
                    games_played: 0,
                    wins: 0,
                    blackjacks: 0,
                    biggest_win: 0
                });
            
            if (error) throw error;
            
            this.userStats = {
                balance: 1000,
                games_played: 0,
                wins: 0,
                blackjacks: 0,
                biggest_win: 0,
                display_name: displayName
            };
            
        } catch (error) {
            console.error('Error creating user stats:', error);
            // Stats might already exist, try loading them
            await this.loadUserStats();
        }
    }
    
    async loadUserStats() {
        try {
            const { data, error } = await supabase
                .from('user_stats')
                .select('*')
                .eq('id', this.user.id)
                .single();
            
            if (error) {
                // If no stats exist, create them
                if (error.code === 'PGRST116') {
                    const displayName = this.user.user_metadata?.display_name || this.user.email?.split('@')[0] || 'Player';
                    await this.createUserStats(displayName, this.user.email);
                    return;
                }
                throw error;
            }
            
            this.userStats = data;
            
        } catch (error) {
            console.error('Error loading user stats:', error);
            // Fallback to defaults
            this.userStats = {
                balance: 1000,
                games_played: 0,
                wins: 0,
                blackjacks: 0,
                biggest_win: 0,
                display_name: 'Player'
            };
        }
    }
    
    async saveUserStats(stats) {
        if (this.isGuest || !this.user) return;
        
        try {
            const { error } = await supabase
                .from('user_stats')
                .update({
                    balance: stats.balance,
                    games_played: stats.gamesPlayed,
                    wins: stats.wins,
                    blackjacks: stats.blackjacks || this.userStats.blackjacks,
                    biggest_win: Math.max(stats.lastWin || 0, this.userStats.biggest_win || 0),
                    updated_at: new Date().toISOString()
                })
                .eq('id', this.user.id);
            
            if (error) throw error;
            
            // Update local cache
            this.userStats.balance = stats.balance;
            this.userStats.games_played = stats.gamesPlayed;
            this.userStats.wins = stats.wins;
            
        } catch (error) {
            console.error('Error saving user stats:', error);
        }
    }
    
    playAsGuest() {
        this.isGuest = true;
        this.user = null;
        this.userStats = {
            balance: 1000,
            games_played: 0,
            wins: 0,
            blackjacks: 0,
            biggest_win: 0,
            display_name: 'Guest'
        };
        this.showGame();
    }
    
    async handleLogout() {
        try {
            if (!this.isGuest) {
                await supabase.auth.signOut();
            }
            
            this.user = null;
            this.isGuest = false;
            this.userStats = null;
            
            // Reset forms
            this.signinForm.reset();
            this.signupForm.reset();
            this.authError.textContent = '';
            this.authError.style.color = '#ef4444';
            
            this.showAuth();
            
        } catch (error) {
            console.error('Logout error:', error);
        }
    }
    
    showGame() {
        this.authScreen.classList.add('hidden');
        this.gameContainer.classList.remove('hidden');
        
        // Update user name display
        const displayName = this.userStats?.display_name || 
                           this.user?.user_metadata?.display_name || 
                           (this.isGuest ? 'Guest' : 'Player');
        this.userNameEl.textContent = displayName;
        
        // Initialize or reinitialize the game
        if (window.game) {
            window.game.loadFromAuth(this.userStats);
        } else {
            window.game = new BlackjackGame(this);
        }
    }
    
    showAuth() {
        this.authScreen.classList.remove('hidden');
        this.gameContainer.classList.add('hidden');
        
        // Destroy game instance
        window.game = null;
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// BLACKJACK GAME
// ═══════════════════════════════════════════════════════════════════════════

class BlackjackGame {
    constructor(authManager) {
        this.authManager = authManager;
        
        this.deck = [];
        this.playerHand = [];
        this.dealerHand = [];
        this.playerValue = 0;
        this.dealerValue = 0;
        this.currentBet = 0;
        this.previousBet = 0;
        this.gameInProgress = false;
        this.playerStood = false;
        this.dealerCardHidden = false;
        this.lastWin = 0;

        // Load stats from auth (with safe fallbacks)
        const stats = (authManager && authManager.userStats) ? authManager.userStats : {};
        this.balance = stats.balance || 1000;
        this.gamesPlayed = stats.games_played || 0;
        this.wins = stats.wins || 0;
        this.blackjacks = stats.blackjacks || 0;

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
        this.betControlsEl = document.getElementById('bet-controls');
        this.chipRackEl = document.querySelector('.chip-rack');
        this.hitBtn = document.getElementById('hit');
        this.standBtn = document.getElementById('stand');
        this.doubleBtn = document.getElementById('double');

        this.init();
    }
    
    loadFromAuth(stats) {
        if (!stats) return;
        
        this.balance = stats.balance || 1000;
        this.gamesPlayed = stats.games_played || 0;
        this.wins = stats.wins || 0;
        this.blackjacks = stats.blackjacks || 0;
        this.updateDisplay();
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
            cardEl.innerHTML = `<div class="card-back"></div>`;
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

        this.balance += this.currentBet;
        this.currentBet = 0;

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

        this.previousBet = this.currentBet;
        this.gameInProgress = true;
        this.gamesPlayed++;
        this.clearHands();
        this.createDeck();

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
            if (this.gameInProgress) {
            this.showGameControls();
            }
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
        this.dealerValue = this.calculateHandValue(this.dealerHand);
        this.dealerValueEl.textContent = this.dealerValue;

        const dealerPlay = () => {
            const currentDealerValue = this.calculateHandValue(this.dealerHand);
            this.dealerValue = currentDealerValue;
            this.dealerValueEl.textContent = currentDealerValue;
            
            if (currentDealerValue >= 17) {
                this.determineWinner();
            } else {
                setTimeout(() => {
                    this.dealCard(this.dealerHand, this.dealerHandEl);
                    setTimeout(dealerPlay, 800);
                }, 500);
            }
        };

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
        this.lastWin = 0;
        
        switch (result) {
            case 'win':
                payout = this.currentBet * 2;
                this.lastWin = this.currentBet;
                this.balance += payout;
                this.wins++;
                break;
            case 'blackjack':
                payout = Math.floor(this.currentBet * 2.5);
                this.lastWin = payout - this.currentBet;
                this.balance += payout;
                this.wins++;
                this.blackjacks++;
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

        // Save to database
        this.saveStats();

        // Visual effects
        const gameContainer = document.getElementById('game-container');
        if (result === 'win' || result === 'blackjack') {
            gameContainer.classList.add('win-glow');
            setTimeout(() => gameContainer.classList.remove('win-glow'), 2000);
        } else if (result === 'lose') {
            gameContainer.classList.add('lose-shake');
            setTimeout(() => gameContainer.classList.remove('lose-shake'), 500);
        }

        setTimeout(() => {
            this.showMessage('Place your bet to play again!');
        }, 3000);
    }
    
    async saveStats() {
        if (this.authManager) {
            await this.authManager.saveUserStats({
                balance: this.balance,
                gamesPlayed: this.gamesPlayed,
                wins: this.wins,
                blackjacks: this.blackjacks,
                lastWin: this.lastWin
            });
        }
    }

    showGameControls() {
        this.betControlsEl.classList.add('hidden');
        this.gameControlsEl.classList.add('active');
        this.chipRackEl.classList.add('disabled');

        if (this.playerHand.length === 2 && this.balance >= this.currentBet) {
            this.doubleBtn.style.visibility = 'visible';
        } else {
            this.doubleBtn.style.visibility = 'hidden';
        }
    }

    hideGameControls() {
        this.betControlsEl.classList.remove('hidden');
        this.gameControlsEl.classList.remove('active');
        this.chipRackEl.classList.remove('disabled');
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

// ═══════════════════════════════════════════════════════════════════════════
// INITIALIZE
// ═══════════════════════════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', () => {
    // Initialize Supabase
    if (initSupabase()) {
        window.authManager = new AuthManager();
    } else {
        // Fallback: start as guest if Supabase fails to load
        console.warn('Starting in guest mode - Supabase not available');
        const authScreen = document.getElementById('auth-screen');
        const gameContainer = document.getElementById('game-container');
        
        if (authScreen) authScreen.classList.add('hidden');
        if (gameContainer) gameContainer.classList.remove('hidden');
        
        // Create a mock auth manager for guest mode
        const guestAuth = {
            userStats: {
                balance: 1000,
                games_played: 0,
                wins: 0,
                blackjacks: 0,
                display_name: 'Guest'
            },
            isGuest: true,
            saveUserStats: async () => {} // No-op for guest mode
        };
        
        window.game = new BlackjackGame(guestAuth);
    }
});
