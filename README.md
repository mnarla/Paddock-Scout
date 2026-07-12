#  Paddock Scout

**Paddock Scout** is a real-time, machine-learning-powered Formula 1 race simulation and podium prediction dashboard. Using advanced predictive models, live web intelligence agents, and stochastic Monte Carlo race simulations, it tracks team performance on the fly, scrapes top motorsport news outlets for aerodynamic upgrades, calculates qualifying and practice pace, runs 1,000 simulated race weekends, and predicts the exact podium finishers for the upcoming Grand Prix!

I designed this project to explore how machine learning, simulation modeling, and automated web agents can be brought together into a clean, premium, and highly responsive web application. I'm hoping to continue building and expanding on these concepts as I head into college!

---

> [!NOTE]
> This project is currently a work in progress! I am still actively adding more features, refining the model, and making sure everything works perfectly under all race weekend scenarios.

---

## What It Does (Features)

*   **Machine Learning Pipeline**: Trains a regularized `RandomForestClassifier` on historical F1 data from 2023–2026. The model uses "v6" features (like rolling championship standings, practice pace, and team car ranks) to avoid memorizing driver names, and applies a massive **×100 training weight** to the 2026 era so the model prioritizes current ground-effect aerodynamics and team hierarchies.
*   **Live Web Intelligence Agent**: Automatically searches top technical motorsport outlets (*The Race*, *F1Technical.net*, *Motorsport.com*) using a DuckDuckGo search agent to extract live updates about MGU-K power clipping, sidepod packages, and wing upgrades.
*   **Intelligent Upgrade Validation**: Cross-references reported news with real-time FP2 results. If a news outlet reports a "major upgrade" but the team is slower than P15 in practice, the upgrade is flagged as unvalidated and its performance boost is automatically discounted.
*   **Monte Carlo Race Simulator**: Runs **1,000 stochastic race simulations** per GP weekend, factoring in Gaussian driver performance noise, rain risk forecasts, and track-specific profiles (such as the Miami GP's technical T11–T16 lock-up section).
*   **Special Physics & Recovery Modifiers**:
    *   *Overtake Index*: Evaluates midfield and front-runner recovery potential when fast cars start out of position.
    *   *Car Rank Alpha*: Grants the #1 ranked team a +15% recovery probability boost if starting outside the Top 5.
    *   📁 **Race Archive**: Explores historical 2026 race weekends, including Q1/Q2/Q3 qualifying times, practice pace averages, and interactive podium cards.

---

## How to Set Up & Run Paddock Scout (for now)

### Prerequisites

*   Python 3.8 to 3.11 installed on your computer.
*   Node.js (v18 or later) installed on your computer — this is required to run the React frontend.
*   An active internet connection (to fetch FastF1 schedule and run the live web search agent).
*   *Note: Zero API keys are needed! Both FastF1 and DuckDuckGo search operate entirely token-free.*

### 1. Clone this Repository

```bash
git clone https://github.com/mnarla/Paddock-Scout.git
cd Paddock-Scout
```

### 2. Set up a Virtual Environment

```bash
# Create the environment
python -m venv venv

# Activate it (Mac/Linux):
source venv/bin/activate

# Activate it (Windows):
venv\Scripts\activate
```

### 3. Install the Dependencies

```bash
pip install -r requirements.txt
```

### 4. Fetch the F1 Race Data

To download all historical seasons (2023–2026) to prepare for model training:

```bash
python backend/data_loader.py
```

Or, fetch just the current race weekend's data (faster):

```bash
python backend/data_loader.py --current
```

### 5. Train the Machine Learning Model

Run the training pipeline to fit the Random Forest model, serialize the persistent label encoders, and output classification reports and charts directly to the `models/` directory:

```bash
python backend/train_model.py
```

### 6. Start the Application

Paddock Scout uses a FastAPI backend and a React frontend. You will need two terminal windows open:

**Terminal 1: Start the API Backend**
```bash
# Make sure your virtual environment is active
source venv/bin/activate

# Start the server
python backend/api_server.py
```

**Terminal 2: Start the React Frontend**
```bash
# Navigate to the frontend directory
cd frontend

# Install frontend dependencies (if running for the first time)
npm install

# Start the Vite development server
npm run dev
```

Open your browser and navigate to the local address output by Vite (usually **http://localhost:5173**) to start predicting podium finishes!

