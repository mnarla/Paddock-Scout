"""
src/app.py — F1 AI Podium Predictor (Live + Archive)
=====================================================
Two-tab dashboard:
  🔴 LIVE  — next race predictions, Weekend Momentum, Monte Carlo
  📁 ARCHIVE — past race results, qualifying grid, practice pace

Run with:  streamlit run src/app.py
"""

import os, glob, sys
import numpy as np
import pandas as pd
import streamlit as st

sys.path.insert(0, os.path.dirname(__file__))
from features import UPGRADE_TEAMS, compute_practice_pace, compute_qualifying_dominance, compute_weekend_momentum
from simulator import run_simulation, get_feature_contributions
from news_agent import fetch_race_intelligence
from calendar_manager import get_next_race_full, get_past_races
from utils import safe_encode, FEATURE_LABELS, standings_rank, normalise_color, track_type
from archive_loader import load_race_results, load_qualifying, load_sprint, load_practice_results, podium_from_results

# ── Page config ───────────────────────────────────────────────────────────────
st.set_page_config(page_title="🏎️ Paddock Scout", page_icon="🏁",
                   layout="wide", initial_sidebar_state="expanded")

st.markdown("""<style>
body,.main{background-color:#0e1117;color:#fff}
.stProgress>div>div>div>div{background-color:#ff1801}
.metric-box{padding:24px 20px;border-radius:12px;
  background:linear-gradient(135deg,#1a1a2e,#16213e);
  text-align:center;box-shadow:0 8px 24px rgba(0,0,0,.5)}
/* Archive mode tint */
.archive-banner{background:linear-gradient(90deg,#1c1c1c,#2a2a2a);
  border-left:4px solid #888;padding:10px 16px;border-radius:8px;
  color:#bbb;font-size:0.9rem;margin-bottom:12px}
</style>""", unsafe_allow_html=True)

MODEL_PATH = "models/f1_podium_predictor.pkl"
DATA_DIR   = "data"

# ── Loaders ───────────────────────────────────────────────────────────────────
@st.cache_resource
def load_model():
    import pickle
    with open(MODEL_PATH,"rb") as f: return pickle.load(f)

@st.cache_data
def build_2026_context():
    files = sorted(glob.glob(os.path.join(DATA_DIR,"results_2026_round*.csv")))
    if not files: return pd.DataFrame()
    frames=[]
    for i,f in enumerate(files):
        df=pd.read_csv(f); df["Round"]=i+1; frames.append(df)
    all_r=pd.concat(frames,ignore_index=True)
    all_r["Position"]=pd.to_numeric(all_r["Position"],errors="coerce")
    all_r["Points"]=pd.to_numeric(all_r["Points"],errors="coerce").fillna(0)
    ss=all_r.groupby("DriverId").agg(
        SeasonPoints=("Points","sum"),AvgFinish=("Position","mean"),
        FullName=("FullName","first"),TeamName=("TeamName","last"),
        TeamColor=("TeamColor","last")).reset_index()
    last3=(all_r.sort_values(["DriverId","Round"]).groupby("DriverId")["Position"]
           .apply(lambda s:s.tail(3).mean()).reset_index()
           .rename(columns={"Position":"Recent_Form_3R"}))
    ss=ss.merge(last3,on="DriverId",how="left")
    trank=all_r.groupby("TeamName")["Points"].sum().rank(ascending=False,method="min")
    ss["Car_Rank"]=ss["TeamName"].map(trank).fillna(trank.max())
    ss["TeamColor"]=ss["TeamColor"].apply(normalise_color)
    qfiles=sorted(glob.glob(os.path.join(DATA_DIR,"results_2026_round*q.csv")))
    if qfiles:
        qdf=pd.read_csv(qfiles[-1])
        qdf["Position"]=pd.to_numeric(qdf["Position"],errors="coerce")
        ss["QualifyingPos"]=ss["DriverId"].map(qdf.set_index("DriverId")["Position"].dropna().astype(int))
    else:
        ss["QualifyingPos"]=np.nan
    return ss

@st.cache_data(ttl=900)
def load_weekend_momentum(year,rnd,is_sprint):
    pp=compute_practice_pace(DATA_DIR,year,rnd)
    qd=compute_qualifying_dominance(DATA_DIR,year,rnd)
    sp=os.path.join(DATA_DIR,f"results_{year}_round{rnd:02d}s.csv")
    if os.path.exists(sp):
        sdf=pd.read_csv(sp); sdf["Position"]=pd.to_numeric(sdf["Position"],errors="coerce")
        sf=sdf.set_index("DriverId")["Position"].dropna().rename("Sprint_Finish")
    else:
        sf=pd.Series(dtype=float,name="Sprint_Finish")
    return compute_weekend_momentum(pp,qd,sf,is_sprint),pp,qd,sf

# ── Guards ────────────────────────────────────────────────────────────────────
if not os.path.exists(MODEL_PATH):
    st.error(f"🚨 Model not found. Run `python src/train_model.py` first."); st.stop()

payload=load_model(); clf=payload["model"]; circuit_enc=payload["circuit_enc"]; FEATURES=payload["features"]; grid_scaler=payload.get("grid_scaler")
ctx=build_2026_context()
if ctx.empty: st.error("No 2026 data in data/. Run data_loader.py first."); st.stop()

# ── Calendar ──────────────────────────────────────────────────────────────────
race_info  = get_next_race_full()
past_races = get_past_races()

# ── Sidebar ───────────────────────────────────────────────────────────────────
with st.sidebar:
    st.image("https://media.formula1.com/image/upload/f_auto/q_auto/v1677244984/"
             "content/dam/fom-website/2018-redesign-assets/F1%20logo.png", width=160)
    st.title("F1 Dashboard")

    # Mode toggle
    mode = st.radio("View Mode", ["🔴 Live Prediction", "📁 Race Archive"],
                    label_visibility="collapsed")
    st.divider()

    if mode == "📁 Race Archive":
        archive_options = {f"Rd {r.round_num} · {r.name} ({r.date:%d %b})": r
                           for r in reversed(past_races)}
        if not archive_options:
            st.info("No past races yet this season.")
            st.stop()
        sel_label = st.selectbox("Select Past Race", list(archive_options.keys()))
        arch_race = archive_options[sel_label]
        st.markdown(f"**Track:** {arch_race.track_type}")
        sprint_note = "Sprint weekend" if arch_race.is_sprint else "Standard weekend"
        st.caption(sprint_note)
    else:
        # Live mode — driver what-if
        sprint_tag = " 🏎️ Sprint" if race_info.is_sprint else ""
        st.markdown(
            f"**Next Race:**\n<span style='color:#ff1801;font-weight:700'>"
            f"{race_info.name}{sprint_tag}</span>\n"
            f"<span style='color:#aaa;font-size:0.85rem'>Rd {race_info.round_num} · "
            f"{race_info.date:%d %b %Y} · {race_info.days_away}d away</span>",
            unsafe_allow_html=True)
        st.caption("Auto-detected from 2026 calendar.")
        st.divider()
        st.subheader("What-If: Single Driver")
        driver_options = sorted(ctx["FullName"].tolist())
        selected_driver = st.selectbox("🧑‍✈️ Driver", driver_options)
        row         = ctx[ctx["FullName"]==selected_driver].iloc[0]
        team_name   = row["TeamName"]; team_color=row["TeamColor"]
        recent_form = float(row["Recent_Form_3R"])
        st.markdown(f"**Team:** <span style='color:{team_color};font-weight:bold'>{team_name}</span>",
                    unsafe_allow_html=True)
        st.markdown(f"**Points:** `{row['SeasonPoints']:.0f}`")
        qpos        = row.get("QualifyingPos",np.nan)
        grid_def    = int(qpos) if pd.notna(qpos) else max(1,int(round(recent_form)))
        grid_pos    = st.slider("Grid Position", 1, 20, value=grid_def)
        manual_form = st.slider("Override Blended Form", 1.0, 20.0,
                                value=round(recent_form,1), step=0.5)
        predict     = st.button("🔮 Predict Probability", type="primary", use_container_width=True)

# ══════════════════════════════════════════════════════════════════════════════
# ARCHIVE TAB
# ══════════════════════════════════════════════════════════════════════════════
if mode == "📁 Race Archive":
    yr  = arch_race.date.year
    rnd = arch_race.round_num

    st.markdown(f"""
    <div class='archive-banner'>
    📁 <strong>Archive Mode</strong> — viewing historical data for
    <strong>{arch_race.name}</strong> · Round {rnd} · {arch_race.date:%d %b %Y}
    · {'Sprint weekend' if arch_race.is_sprint else 'Standard weekend'}<br>
    <em>ML predictions are disabled. Showing actual recorded results.</em>
    </div>""", unsafe_allow_html=True)

    st.title(f"📁 {arch_race.name} — {arch_race.date.year}")

    race_df = load_race_results(yr, rnd)

    # ── Podium cards ──────────────────────────────────────────────────────────
    if not race_df.empty:
        st.markdown("### 🏆 Race Podium")
        podium = podium_from_results(race_df)
        medals_label = {1:"Race Winner",2:"2nd Place",3:"3rd Place"}
        p_cols = st.columns(3)
        for p, col in zip(podium, p_cols):
            c = p["color"]
            with col:
                st.markdown(
                    f'<div style="padding:20px 14px;border-radius:14px;'
                    f'background:linear-gradient(160deg,#1c1c1c,#252525);'
                    f'border-top:6px solid {c};text-align:center;'
                    f'box-shadow:0 6px 24px rgba(0,0,0,.6)">'
                    f'<div style="font-size:2rem">{p["medal"]}</div>'
                    f'<div style="font-size:1rem;font-weight:700;margin:6px 0 2px;color:#ddd">{p["driver"]}</div>'
                    f'<div style="color:{c};font-size:0.8rem;font-weight:600;margin-bottom:10px">{p["team"]}</div>'
                    f'<div style="border-top:1px solid #333;padding-top:10px;color:#aaa;font-size:0.75rem">'
                    f'{medals_label[p["position"]]}</div>'
                    f'<div style="font-size:1.5rem;font-weight:800;color:{c}">{p["points"]} pts</div>'
                    f'<div style="color:#666;font-size:0.7rem">Started P{p["grid"]}</div>'
                    f'</div>', unsafe_allow_html=True)
        st.divider()

        # ── Full race results ─────────────────────────────────────────────────
        with st.expander("🏁 Full Race Results", expanded=True):
            cols = [c for c in ["Medal","Position","FullName","TeamName","GridPosition",
                                "Positions Gained","Points","Status","Laps"] if c in race_df.columns]
            disp = race_df[cols].rename(columns={
                "FullName":"Driver","TeamName":"Team",
                "GridPosition":"Grid","Position":"Pos"})
            st.dataframe(disp, hide_index=True, use_container_width=True,
                         height=min(len(disp)*38+50,750))
    else:
        st.warning(f"No race result CSV found for Round {rnd}. "
                   "Run `python src/data_loader.py --current` to fetch data.")

    # ── Qualifying grid ───────────────────────────────────────────────────────
    quali_df = load_qualifying(yr, rnd)
    with st.expander("⏱️ Qualifying Grid", expanded=bool(not quali_df.empty)):
        if quali_df.empty:
            st.info("No qualifying data available for this round.")
        else:
            cols = [c for c in ["Position","FullName","TeamName","Q1","Q2","Q3"]
                    if c in quali_df.columns]
            st.dataframe(quali_df[cols].rename(columns={"FullName":"Driver","TeamName":"Team","Position":"Grid"}),
                         hide_index=True, use_container_width=True)

    # ── Sprint results (if applicable) ────────────────────────────────────────
    if arch_race.is_sprint:
        sprint_df = load_sprint(yr, rnd)
        with st.expander("🏎️ Sprint Results", expanded=bool(not sprint_df.empty)):
            if sprint_df.empty:
                st.info("No sprint data available for this round.")
            else:
                cols = [c for c in ["Medal","Position","FullName","TeamName","Points","Status"]
                        if c in sprint_df.columns]
                st.dataframe(sprint_df[cols].rename(columns={"FullName":"Driver","TeamName":"Team","Position":"Pos"}),
                             hide_index=True, use_container_width=True)

    # ── Practice pace ─────────────────────────────────────────────────────────
    fp_results = load_practice_results(yr, rnd)
    with st.expander("🔧 Practice Pace (FP1/FP2/FP3 Average)", expanded=False):
        if not fp_results or all(df.empty for df in fp_results.values()):
            st.info("No practice data available for this round.")
        else:
            st.info("Detailed practice results are now only available on the React UI.")

# ══════════════════════════════════════════════════════════════════════════════
# LIVE PREDICTION TAB
# ══════════════════════════════════════════════════════════════════════════════
else:
    selected_gp = race_info.name
    is_sprint   = race_info.is_sprint
    rnd_num     = race_info.round_num
    year        = race_info.date.year

    momentum_series, practice_pace, quali_dom, sprint_finish = load_weekend_momentum(
        year, rnd_num, is_sprint)

    st.title("🏎️ Paddock Scout — 2026 Season")
    st.caption(f"Live-First · RF v6 · Overtake_Index + Standings_Floor · "
               f"Weekend Momentum (Rd {rnd_num})")

    # ── SECTION 1: Single driver prediction ───────────────────────────────────
    if predict:
        c_enc        = safe_encode(circuit_enc, selected_gp)
        car_rank     = float(row.get("Car_Rank", 5))
        upgrade      = 0.5 if team_name in UPGRADE_TEAMS else 0.0
        overtake_idx = float(np.clip(grid_pos - car_rank, -10, 15))
        s_rank       = standings_rank(ctx, selected_driver)
        drv_id       = row["DriverId"]
        pp_val       = float(practice_pace.get(drv_id, 11.0))
        qd_val       = float(quali_dom.get(drv_id, 0.02))
        wm_val       = float(momentum_series.get(drv_id, 11.0))

        feature_dict = {
            "Recent_Form_3R": manual_form,
            "GridPosition": float(grid_scaler.transform([[grid_pos]])[0][0]) if grid_scaler else float(grid_pos),
            "Car_Rank": car_rank,
            "Circuit_Encoded": c_enc,
            "Upgrade_Impact": upgrade,
            "Overtake_Index": overtake_idx,
            "Standings_Pos": s_rank,
            "Practice_Pace": pp_val,
            "Qualifying_Dominance": qd_val,
            "Weekend_Momentum": wm_val
        }
        X = np.array([[feature_dict.get(f, 0.0) for f in FEATURES]])
        raw_prob = clf.predict_proba(X)[0][1]
        
        if not momentum_series.empty:
            raw_prob = min(1.0, raw_prob + max(0.0, (11.0 - wm_val)/11.0*0.15))
            
        # Champion's Aura
        if s_rank == 1 and grid_pos <= 10:
            raw_prob = max(raw_prob, 0.70)
        elif s_rank <= 3 and grid_pos <= 8:
            raw_prob = max(raw_prob, 0.60)
            
        # Car_Rank Alpha
        if car_rank == 1 and grid_pos > 5:
            raw_prob = min(1.0, raw_prob + 0.15)
        elif car_rank <= 2 and grid_pos > 3:
            gap = min(grid_pos - 3, 7)
            raw_prob = min(1.0, raw_prob * (1.0 + 0.015 * gap))
        pct = raw_prob * 100

        st.markdown(f"## 🎯 Prediction — {selected_driver}")
        r1, r2, r3 = st.columns([1.2, 1.5, 1.3])
        with r1:
            st.markdown(
                f'<div class="metric-box" style="border-top:5px solid {team_color}">'
                f'<div style="font-size:1.1rem;font-weight:600">{selected_driver}</div>'
                f'<div style="color:#aaa;font-size:0.85rem">{team_name}</div>'
                f'<div style="font-size:3rem;font-weight:700;color:{team_color}">{pct:.1f}%</div>'
                f'<div style="color:#aaa;font-size:0.8rem">Podium Probability</div></div>',
                unsafe_allow_html=True)
        with r2:
            st.markdown("### Prediction Breakdown")
            st.progress(float(raw_prob))
            if raw_prob > 0.60:   st.success("🔥 Genuine podium contender!")
            elif raw_prob > 0.30: st.warning("⚔️ Could sneak a podium.")
            else:                 st.error("📉 Podium very unlikely.")
        with r3:
            st.markdown("### Weekend Inputs")
            st.dataframe(pd.DataFrame({
                "Feature":["Grid","Form","Car Rank","Overtake","FP Avg","Q Gap","Momentum"],
                "Value":[f"P{grid_pos}",f"P{manual_form:.1f}",f"#{int(car_rank)}",
                         f"{overtake_idx:+.0f}",f"P{pp_val:.1f}",
                         f"+{qd_val*100:.3f}%",f"{wm_val:.2f}"]}),
                hide_index=True, use_container_width=True)

        st.markdown("### 🧠 How the AI Decided")
        contribs  = get_feature_contributions(X[0], FEATURES, clf, raw_prob)
        col_pos, col_neg = st.columns(2)
        with col_pos:
            st.markdown("**✅ Positive Drivers**")
            for c in [x for x in contribs if x["direction"]=="positive"]:
                label=FEATURE_LABELS.get(c["feature"],c["feature"])
                st.markdown(f'<div style="background:#0d2b1a;border-left:4px solid #00cc66;'
                            f'padding:8px 12px;margin:4px 0;border-radius:6px;font-size:0.85rem">'
                            f'<span style="color:#00cc66;font-weight:600">{label}</span> '
                            f'<span style="color:#aaa">(+{c["delta"]*100:.1f}%)</span></div>',
                            unsafe_allow_html=True)
        with col_neg:
            st.markdown("**⚠️ Negative Drivers**")
            for c in [x for x in contribs if x["direction"]=="negative"]:
                label=FEATURE_LABELS.get(c["feature"],c["feature"])
                st.markdown(f'<div style="background:#2b0d0d;border-left:4px solid #cc3300;'
                            f'padding:8px 12px;margin:4px 0;border-radius:6px;font-size:0.85rem">'
                            f'<span style="color:#cc3300;font-weight:600">{label}</span> '
                            f'<span style="color:#aaa">(-{abs(c["delta"])*100:.1f}%)</span></div>',
                            unsafe_allow_html=True)
        st.divider()
    else:
        st.info("👈 Select a driver and click **🔮 Predict Probability** to see their chances.")
        st.divider()

    # ── SECTION 2: Weekend Momentum leaderboard ───────────────────────────────
    sprint_note = "Sprint finish weighted 2.5×. " if is_sprint else ""
    with st.expander(f"📊 Weekend Momentum Leaderboard — {selected_gp}",
                     expanded=not predict):
        st.caption(f"{sprint_note}Lower = stronger momentum. "
                   f"Blends Practice Pace + Qualifying Dominance"
                   + (" + Sprint Finish." if is_sprint else "."))
        if momentum_series.empty:
            st.info("No FP/Quali data yet. Run `python src/data_loader.py --current`.")
        else:
            mom_df = momentum_series.reset_index()
            mom_df.columns = ["DriverId","Weekend_Momentum"]
            mom_df = mom_df.merge(ctx[["DriverId","FullName","TeamName","QualifyingPos"]],
                                  on="DriverId",how="left")
            mom_df["FP Avg"]  = mom_df["DriverId"].map(practice_pace).fillna(11.0).apply(lambda x:f"P{x:.1f}")
            mom_df["Q Gap"]   = mom_df["DriverId"].map(quali_dom).fillna(0.02).apply(lambda x:f"+{x*100:.3f}%")
            mom_df["Grid"]    = mom_df["QualifyingPos"].fillna(11).astype(int)
            if is_sprint and not sprint_finish.empty:
                mom_df["Sprint P"] = mom_df["DriverId"].map(sprint_finish).apply(
                    lambda x: f"P{int(x)}" if pd.notna(x) else "–")
            mom_df["Momentum ↓"] = mom_df["Weekend_Momentum"].apply(lambda x:f"{x:.2f}")
            mom_df = mom_df.sort_values("Weekend_Momentum").reset_index(drop=True)
            mom_df.index += 1
            keep = ["FullName","TeamName","Grid","FP Avg","Q Gap","Momentum ↓"]
            if "Sprint P" in mom_df.columns: keep.insert(5,"Sprint P")
            st.dataframe(mom_df[keep].rename(columns={"FullName":"Driver","TeamName":"Team"}),
                         use_container_width=True,
                         height=min(len(mom_df)*38+50, 700))
    st.divider()

    # ── SECTION 3: Monte Carlo simulation ─────────────────────────────────────
    st.subheader("🎲 Monte Carlo Race Simulation")
    st.markdown("Run **1,000 stochastic simulations** for the full grid. "
                "Injects random noise, upgrade boosts and Recovery_Boost.")
    c1, c2 = st.columns([3,1])
    with c1: st.markdown(f"Simulating the full grid for **{selected_gp}**.")
    with c2: run_sim = st.button("🏁 Run Race Simulation", type="primary", use_container_width=True)

    if run_sim:
        with st.spinner("Running 1,000 race simulations … 🏎️"):
            intel = fetch_race_intelligence(selected_gp)
            result = run_simulation({
                "grand_prix": selected_gp,
                "track_type": track_type(selected_gp),
                "wetness_factor": intel["Wetness_Factor"],
                "upgrade_teams": ["Ferrari","McLaren"] if intel["Upgrade_Score"]>0.6 else [],
                "upgrade_score": intel["Upgrade_Score"],
            })
        st.success(f"✅ Completed {result['n_simulations']:,} simulations!")
        b1,b2 = st.columns(2)
        with b1: st.metric("Rain Risk",f"{intel['Wetness_Factor']*100:.0f}%")
        with b2: st.metric("Upgrade Activity",f"{intel['Upgrade_Score']*100:.0f}%")
        st.divider()
        st.markdown("### 🏆 Predicted Podium")
        pos_labels={1:"Wins P1",2:"Finishes P2",3:"Finishes P3"}
        for p,col in zip(result["podium"],st.columns(3)):
            clr=p["color"]; bp=f"{p['position_freq']:.1f}"
            with col:
                st.markdown(
                    f'<div style="padding:22px 16px;border-radius:14px;'
                    f'background:linear-gradient(160deg,#1a1a2e,#16213e);'
                    f'border-top:6px solid {clr};text-align:center;'
                    f'box-shadow:0 8px 32px rgba(0,0,0,.55)">'
                    f'<div style="font-size:2.2rem">{p["medal"]}</div>'
                    f'<div style="font-size:1.05rem;font-weight:700;margin:6px 0 2px">{p["driver"]}</div>'
                    f'<div style="color:{clr};font-size:0.82rem;font-weight:600;margin-bottom:12px">{p["team"]}</div>'
                    f'<div style="border-top:1px solid #2a2a4a;padding-top:12px">'
                    f'<div style="color:#aaa;font-size:0.72rem;text-transform:uppercase">{pos_labels[p["position"]]}</div>'
                    f'<div style="font-size:2.6rem;font-weight:800;color:{clr}">{bp}%</div>'
                    f'<div style="color:#666;font-size:0.7rem">of 1,000 sims</div></div>'
                    f'<div style="margin-top:10px;background:#0e1117;border-radius:6px;height:8px">'
                    f'<div style="width:{bp}%;height:8px;border-radius:6px;'
                    f'background:linear-gradient(90deg,{clr}88,{clr})"></div></div>'
                    f'<div style="margin-top:8px;color:#888;font-size:0.72rem">'
                    f'Any podium: <span style="color:{clr};font-weight:600">{p["podium_freq"]:.1f}%</span></div>'
                    f'</div>', unsafe_allow_html=True)
        st.divider()
        with st.expander("📊 Full Frequency Table"):
            st.dataframe(result["full_counts"], use_container_width=True)


