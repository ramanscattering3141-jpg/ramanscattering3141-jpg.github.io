# Generates data/aircraft/*.json. Real-world figures live in each "spec" block with their
# source; aerodynamic "model" values are simulation estimates (see src/aircraft/types.ts).
# Usage: python3 tools/gen-aircraft.py  (run from the repository root)
import json, copy
GA_AERO = dict(cl0=0.307, clAlpha=4.41, clMaxClean=1.53, dClMaxFlaps=0.35, dCl0Flaps=0.45, cd0=0.032, dCd0Flaps=0.05, dCdGear=0.0, dCdSpoilers=0.0, oswald=0.75,
  cyBeta=-0.393, clBeta=-0.0923, clP=-0.484, clR=0.0798, clDa=0.229, clDr=0.0147, cm0=0.04, cmAlpha=-0.613, cmQ=-12.4, cmDe=-1.122, cmFlaps=-0.06,
  cnBeta=0.0587, cnR=-0.0937, cnP=-0.0278, cnDa=-0.0216, cnDr=-0.0645, cyDr=0.187, elevatorMaxDeg=25, aileronMaxDeg=18, rudderMaxDeg=17)
JET_AERO = dict(cl0=0.25, clAlpha=5.6, clMaxClean=1.40, dClMaxFlaps=1.2, dCl0Flaps=0.85, cd0=0.019, dCd0Flaps=0.075, dCdGear=0.018, dCdSpoilers=0.06, oswald=0.8, mdd=0.84,
  cyBeta=-0.9, clBeta=-0.18, clP=-0.40, clR=0.18, clDa=0.085, clDr=0.008, cm0=0.045, cmAlpha=-1.2, cmQ=-20.0, cmDe=-1.35, cmFlaps=-0.08,
  cnBeta=0.16, cnR=-0.28, cnP=-0.08, cnDa=0.002, cnDr=-0.10, cyDr=0.12, elevatorMaxDeg=25, aileronMaxDeg=20, rudderMaxDeg=25)
def aero(base, **kw):
    a = copy.deepcopy(base); a.update(kw); return a
def F(*t): return [dict(label=l, frac=f, maxKt=k) for (l,f,k) in t]
AC = []
AC.append(dict(id="c172", name="Cessna 172S Skyhawk", manufacturer="Cessna (Textron Aviation)", category="general aviation", cockpit="ga",
 spec=dict(source="Cessna 172S Pilot's Operating Handbook / Textron Aviation specification", mtowKg=1157, emptyKg=767, wingspanM=11.0, lengthM=8.28,
   wingAreaM2=16.2, fuelCapacityL=212, engineCount=1, engineModel="Lycoming IO-360-L2A (180 hp)", powerKW=134, vmoKt=163, stallKt=40, cruiseKtas=124, ceilingFt=14000, climbFpm=730, rangeNm=640,
   approximate=["emptyKg (varies by airframe)"]),
 flaps=F(("UP",0,0),("10°",0.3,110),("20°",0.65,85),("30°",1.0,85)),
 gyration=[0.248,0.338,0.393], aero=aero(GA_AERO),
 engine=dict(kind="piston", positionsY=[0], propEfficiency=0.8, staticThrustKN=2.2, idleFraction=0.04, spoolTime=0.6, sfc=0.274, reverseFraction=0, startTime=3),
 gear=dict(retractable=False, noseX=1.3, mainX=-0.35, mainHalfTrack=1.25, heightM=1.35, compressionM=0.12, maxSteerDeg=10, limitSinkMs=3.4, transitTime=0),
 geometry=dict(wingPosition="high", sweepDeg=0, taper=0.7, dihedralDeg=1.7, fuselageDiameterM=1.2, tail="conventional", engineMount="nose", tailStrikeDeg=14,
   eye=[0.5,-0.3,-0.55], colors=dict(body="#f4f4f0", accent="#1f4e9c", tail="#1f4e9c")),
 perf=dict(maxBankDeg=25, maxVsFpm=700, vrKt=55, v2Kt=65, vrefKt=65, climbKt=74, cruiseAltFt=6500, approachKt=70, rotatePitchDeg=8),
 fuelDensity=0.72, defaultPayloadKg=220))
AC.append(dict(id="pc12", name="Pilatus PC-12 NGX", manufacturer="Pilatus Aircraft", category="turboprop", cockpit="glass",
 spec=dict(source="Pilatus PC-12 NGX published specifications (pilatus-aircraft.com)", mtowKg=4740, emptyKg=3050, wingspanM=16.28, lengthM=14.40, wingAreaM2=25.81,
   fuelCapacityL=1522, engineCount=1, engineModel="Pratt & Whitney Canada PT6E-67XP (1,200 shp)", powerKW=895, vmoKt=240, stallKt=67, cruiseKtas=290, ceilingFt=30000, climbFpm=1920, rangeNm=1803,
   approximate=["emptyKg","vmoKt","climbFpm"]),
 flaps=F(("0°",0,0),("15°",0.45,163),("30°",0.8,130),("40°",1.0,119)),
 gyration=[0.25,0.34,0.40], aero=aero(GA_AERO, cl0=0.28, clAlpha=5.0, clMaxClean=1.55, dClMaxFlaps=0.95, dCl0Flaps=0.7, cd0=0.024, dCdGear=0.012, oswald=0.8, cmAlpha=-0.9, cmQ=-15, cmDe=-1.2, clDa=0.17),
 engine=dict(kind="turboprop", positionsY=[0], propEfficiency=0.82, staticThrustKN=12.5, idleFraction=0.05, spoolTime=1.8, sfc=0.36, reverseFraction=0.35, startTime=20),
 gear=dict(retractable=True, noseX=2.9, mainX=-0.45, mainHalfTrack=2.3, heightM=1.7, compressionM=0.15, maxSteerDeg=30, limitSinkMs=3.0, transitTime=6),
 geometry=dict(wingPosition="low", sweepDeg=2, taper=0.55, dihedralDeg=4, fuselageDiameterM=1.6, tail="t-tail", engineMount="nose", tailStrikeDeg=13,
   eye=[3.6,-0.35,-0.7], colors=dict(body="#f5f5f5", accent="#b01e2e", tail="#b01e2e")),
 perf=dict(maxBankDeg=25, maxVsFpm=1500, vrKt=85, v2Kt=100, vrefKt=90, climbKt=130, cruiseAltFt=24000, approachKt=100, rotatePitchDeg=9),
 fuelDensity=0.8, defaultPayloadKg=600))
AC.append(dict(id="cj4", name="Cessna Citation CJ4", manufacturer="Cessna (Textron Aviation)", category="business jet", cockpit="glass",
 spec=dict(source="Textron Aviation Citation CJ4 specifications", mtowKg=7761, emptyKg=4663, wingspanM=15.49, lengthM=16.26, wingAreaM2=30.66, fuelCapacityL=3300,
   engineCount=2, engineModel="Williams International FJ44-4A (3,621 lbf)", thrustKN=16.1, vmoKt=305, mmo=0.77, cruiseKtas=451, ceilingFt=45000, climbFpm=3854, rangeNm=2165,
   approximate=["emptyKg","fuelCapacityL (converted from 5,828 lb usable)"]),
 flaps=F(("UP",0,0),("15°",0.45,200),("35°",1.0,161)),
 gyration=[0.26,0.35,0.42], aero=aero(JET_AERO, clMaxClean=1.35, dClMaxFlaps=0.75, dCl0Flaps=0.55, cd0=0.021, mdd=0.8, clDa=0.1, cnBeta=0.13),
 engine=dict(kind="turbofan", positionsY=[-1.4,1.4], idleFraction=0.06, spoolTime=3.0, sfc=0.045, reverseFraction=0.0, startTime=25),
 gear=dict(retractable=True, noseX=5.8, mainX=-0.5, mainHalfTrack=1.8, heightM=1.6, compressionM=0.15, maxSteerDeg=40, limitSinkMs=3.05, transitTime=6),
 geometry=dict(wingPosition="low", sweepDeg=12.5, taper=0.4, dihedralDeg=4, fuselageDiameterM=1.7, tail="t-tail", engineMount="tail", tailStrikeDeg=12,
   eye=[5.7,-0.35,-0.75], colors=dict(body="#f2f2f2", accent="#20242b", tail="#6e7580"), winglets=False),
 perf=dict(maxBankDeg=25, maxVsFpm=3000, vrKt=105, v2Kt=120, vrefKt=112, climbKt=240, cruiseMach=0.72, cruiseAltFt=41000, approachKt=125, rotatePitchDeg=10),
 fuelDensity=0.8, defaultPayloadKg=500))
AC.append(dict(id="b738", name="Boeing 737-800", manufacturer="Boeing", category="narrowbody", cockpit="glass",
 spec=dict(source="Boeing 737 Airplane Characteristics for Airport Planning (D6-58325-6)", mtowKg=79016, emptyKg=41413, wingspanM=35.79, lengthM=39.47, wingAreaM2=124.58,
   fuelCapacityL=26020, engineCount=2, engineModel="CFM International CFM56-7B26 (26,300 lbf)", thrustKN=117.0, vmoKt=340, mmo=0.82, cruiseKtas=453, ceilingFt=41000, rangeNm=2935),
 flaps=F(("UP",0,0),("1",0.12,250),("5",0.35,250),("15",0.55,200),("30",0.85,175),("40",1.0,162)),
 gyration=[0.25,0.38,0.44], aero=aero(JET_AERO, mdd=0.84),
 engine=dict(kind="turbofan", positionsY=[-4.9,4.9], idleFraction=0.05, spoolTime=3.5, sfc=0.0367, reverseFraction=0.4, startTime=40),
 gear=dict(retractable=True, noseX=14.2, mainX=-1.0, mainHalfTrack=2.86, heightM=2.9, compressionM=0.25, maxSteerDeg=70, limitSinkMs=3.05, transitTime=8),
 geometry=dict(wingPosition="low", sweepDeg=25, taper=0.28, dihedralDeg=6, fuselageDiameterM=3.76, tail="conventional", engineMount="wing", tailStrikeDeg=11,
   eye=[16.8,-0.55,-1.5], colors=dict(body="#f5f6f8", accent="#1d3f8a", tail="#1d3f8a"), winglets=True),
 perf=dict(maxBankDeg=25, maxVsFpm=4000, vrKt=145, v2Kt=155, vrefKt=142, climbKt=280, cruiseMach=0.785, cruiseAltFt=35000, approachKt=150, rotatePitchDeg=8)))
AC.append(dict(id="a320", name="Airbus A320ceo", manufacturer="Airbus", category="narrowbody", cockpit="glass",
 spec=dict(source="Airbus A320 Aircraft Characteristics - Airport and Maintenance Planning", mtowKg=78000, emptyKg=42600, wingspanM=35.80, lengthM=37.57, wingAreaM2=122.6,
   fuelCapacityL=24210, engineCount=2, engineModel="CFM International CFM56-5B4 (27,000 lbf)", thrustKN=120.1, vmoKt=350, mmo=0.82, cruiseKtas=447, ceilingFt=39100, rangeNm=3300,
   approximate=["emptyKg (operating empty, varies by operator)"]),
 flaps=F(("0",0,0),("1",0.2,230),("1+F",0.35,215),("2",0.55,200),("3",0.75,185),("FULL",1.0,177)),
 gyration=[0.25,0.38,0.44], aero=aero(JET_AERO, mdd=0.84, dClMaxFlaps=1.3),
 engine=dict(kind="turbofan", positionsY=[-5.75,5.75], idleFraction=0.05, spoolTime=3.5, sfc=0.0367, reverseFraction=0.4, startTime=40),
 gear=dict(retractable=True, noseX=12.6, mainX=-1.0, mainHalfTrack=3.8, heightM=3.1, compressionM=0.25, maxSteerDeg=75, limitSinkMs=3.05, transitTime=8),
 geometry=dict(wingPosition="low", sweepDeg=25, taper=0.24, dihedralDeg=5.1, fuselageDiameterM=3.95, tail="conventional", engineMount="wing", tailStrikeDeg=11.7,
   eye=[15.5,-0.55,-1.5], colors=dict(body="#f7f7f7", accent="#0c2a6b", tail="#c4122f"), winglets=True),
 perf=dict(maxBankDeg=25, maxVsFpm=4000, vrKt=145, v2Kt=155, vrefKt=137, climbKt=290, cruiseMach=0.78, cruiseAltFt=35000, approachKt=145, rotatePitchDeg=8)))
AC.append(dict(id="b744", name="Boeing 747-400", manufacturer="Boeing", category="widebody", cockpit="glass",
 spec=dict(source="Boeing 747-400 Airplane Characteristics for Airport Planning (D6-58326-1)", mtowKg=396890, emptyKg=178756, wingspanM=64.44, lengthM=70.66, wingAreaM2=525,
   fuelCapacityL=216840, engineCount=4, engineModel="Pratt & Whitney PW4056 (56,750 lbf)", thrustKN=252.4, vmoKt=365, mmo=0.92, cruiseKtas=493, ceilingFt=45100, rangeNm=7260,
   approximate=["emptyKg (operating empty, varies by configuration)"]),
 flaps=F(("UP",0,0),("1",0.12,280),("5",0.3,260),("10",0.45,240),("20",0.65,230),("25",0.85,205),("30",1.0,180)),
 gyration=[0.28,0.38,0.46], aero=aero(JET_AERO, clAlpha=5.7, mdd=0.88, cd0=0.018, clDa=0.075, cmAlpha=-1.3, cmDe=-1.4),
 engine=dict(kind="turbofan", positionsY=[-21.2,-11.9,11.9,21.2], idleFraction=0.05, spoolTime=4.0, sfc=0.0345, reverseFraction=0.35, startTime=45),
 gear=dict(retractable=True, noseX=25.0, mainX=-1.8, mainHalfTrack=5.5, heightM=5.2, compressionM=0.3, maxSteerDeg=70, limitSinkMs=3.05, transitTime=10),
 geometry=dict(wingPosition="low", sweepDeg=37.5, taper=0.28, dihedralDeg=7, fuselageDiameterM=6.5, tail="conventional", engineMount="wing", tailStrikeDeg=11,
   eye=[30.0,-0.6,-3.5], colors=dict(body="#f6f6f6", accent="#1b3e7a", tail="#1b3e7a"), hump=True, winglets=True),
 perf=dict(maxBankDeg=25, maxVsFpm=3500, vrKt=160, v2Kt=170, vrefKt=150, climbKt=300, cruiseMach=0.85, cruiseAltFt=35000, approachKt=160, rotatePitchDeg=9)))
AC.append(dict(id="b77w", name="Boeing 777-300ER", manufacturer="Boeing", category="widebody", cockpit="glass",
 spec=dict(source="Boeing 777-200LR/-300ER/-Freighter Airplane Characteristics for Airport Planning (D6-58329-2)", mtowKg=351534, emptyKg=167829, wingspanM=64.80, lengthM=73.86, wingAreaM2=436.8,
   fuelCapacityL=181283, engineCount=2, engineModel="GE Aerospace GE90-115B (115,300 lbf)", thrustKN=513.0, vmoKt=330, mmo=0.89, cruiseKtas=482, ceilingFt=43100, rangeNm=7370),
 flaps=F(("UP",0,0),("1",0.12,255),("5",0.3,235),("15",0.55,215),("20",0.7,195),("25",0.85,185),("30",1.0,170)),
 gyration=[0.27,0.38,0.45], aero=aero(JET_AERO, clAlpha=5.8, mdd=0.87, cd0=0.0175, clDa=0.08, cmAlpha=-1.3, cmDe=-1.4),
 engine=dict(kind="turbofan", positionsY=[-9.6,9.6], idleFraction=0.045, spoolTime=4.5, sfc=0.0305, reverseFraction=0.35, startTime=45),
 gear=dict(retractable=True, noseX=29.0, mainX=-1.8, mainHalfTrack=5.5, heightM=4.6, compressionM=0.3, maxSteerDeg=70, limitSinkMs=3.05, transitTime=10),
 geometry=dict(wingPosition="low", sweepDeg=33, taper=0.25, dihedralDeg=6, fuselageDiameterM=6.2, tail="conventional", engineMount="wing", tailStrikeDeg=8.5,
   eye=[33.0,-0.6,-2.8], colors=dict(body="#f7f7f7", accent="#1a4f8b", tail="#1a4f8b"), winglets=False),
 perf=dict(maxBankDeg=25, maxVsFpm=3500, vrKt=165, v2Kt=175, vrefKt=150, climbKt=300, cruiseMach=0.84, cruiseAltFt=35000, approachKt=160, rotatePitchDeg=7.5)))
AC.append(dict(id="b789", name="Boeing 787-9 Dreamliner", manufacturer="Boeing", category="widebody", cockpit="glass",
 spec=dict(source="Boeing 787 Airplane Characteristics for Airport Planning (D6-58333)", mtowKg=254011, emptyKg=128850, wingspanM=60.12, lengthM=62.81, wingAreaM2=377,
   fuelCapacityL=126372, engineCount=2, engineModel="GE Aerospace GEnx-1B74/75 (74,100 lbf)", thrustKN=330.0, vmoKt=340, mmo=0.90, cruiseKtas=488, ceilingFt=43100, rangeNm=7530,
   approximate=["emptyKg","wingAreaM2"]),
 flaps=F(("UP",0,0),("1",0.12,250),("5",0.3,230),("15",0.55,200),("20",0.7,190),("25",0.85,175),("30",1.0,170)),
 gyration=[0.27,0.38,0.45], aero=aero(JET_AERO, clAlpha=5.9, mdd=0.88, cd0=0.0165, clDa=0.085),
 engine=dict(kind="turbofan", positionsY=[-9.7,9.7], idleFraction=0.045, spoolTime=4.0, sfc=0.0285, reverseFraction=0.35, startTime=45),
 gear=dict(retractable=True, noseX=24.0, mainX=-1.6, mainHalfTrack=4.9, heightM=4.1, compressionM=0.3, maxSteerDeg=70, limitSinkMs=3.05, transitTime=10),
 geometry=dict(wingPosition="low", sweepDeg=32, taper=0.24, dihedralDeg=6, fuselageDiameterM=5.77, tail="conventional", engineMount="wing", tailStrikeDeg=9.5,
   eye=[27.5,-0.6,-2.6], colors=dict(body="#f7f7f7", accent="#113a74", tail="#113a74"), winglets=False),
 perf=dict(maxBankDeg=25, maxVsFpm=3500, vrKt=160, v2Kt=170, vrefKt=145, climbKt=300, cruiseMach=0.85, cruiseAltFt=37000, approachKt=155, rotatePitchDeg=8)))
AC.append(dict(id="a359", name="Airbus A350-900", manufacturer="Airbus", category="widebody", cockpit="glass",
 spec=dict(source="Airbus A350 Aircraft Characteristics - Airport and Maintenance Planning", mtowKg=283000, emptyKg=142400, wingspanM=64.75, lengthM=66.80, wingAreaM2=442,
   fuelCapacityL=141000, engineCount=2, engineModel="Rolls-Royce Trent XWB-84 (84,200 lbf)", thrustKN=374.5, vmoKt=340, mmo=0.89, cruiseKtas=488, ceilingFt=43100, rangeNm=8100,
   approximate=["emptyKg","vmoKt"]),
 flaps=F(("0",0,0),("1",0.2,255),("1+F",0.35,222),("2",0.55,212),("3",0.75,195),("FULL",1.0,186)),
 gyration=[0.27,0.38,0.45], aero=aero(JET_AERO, clAlpha=5.9, mdd=0.88, cd0=0.0165, clDa=0.085),
 engine=dict(kind="turbofan", positionsY=[-10.5,10.5], idleFraction=0.045, spoolTime=4.0, sfc=0.028, reverseFraction=0.35, startTime=45),
 gear=dict(retractable=True, noseX=26.0, mainX=-1.7, mainHalfTrack=5.4, heightM=4.3, compressionM=0.3, maxSteerDeg=70, limitSinkMs=3.05, transitTime=10),
 geometry=dict(wingPosition="low", sweepDeg=31.9, taper=0.22, dihedralDeg=6, fuselageDiameterM=5.96, tail="conventional", engineMount="wing", tailStrikeDeg=10,
   eye=[29.0,-0.6,-2.7], colors=dict(body="#f7f7f7", accent="#1c1c1c", tail="#0d5c91"), winglets=True),
 perf=dict(maxBankDeg=25, maxVsFpm=3500, vrKt=155, v2Kt=165, vrefKt=140, climbKt=300, cruiseMach=0.85, cruiseAltFt=37000, approachKt=150, rotatePitchDeg=8)))
payload = dict(b738=15000, a320=15000, b744=45000, b77w=40000, b789=30000, a359=32000)
for a in AC:
    a.setdefault('fuelDensity', 0.8)
    a.setdefault('defaultPayloadKg', payload.get(a['id'], 1000))
    json.dump(a, open(f"data/aircraft/{a['id']}.json","w"), indent=1)
print(len(AC))
