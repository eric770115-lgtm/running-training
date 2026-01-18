import React, { useState } from 'react';
import { Activity, Heart, Target, Calendar, AlertCircle, CheckCircle, TrendingUp, Zap, Info } from 'lucide-react';

const RunningTrainingSystem = () => {
  const [step, setStep] = useState(1);
  const [profile, setProfile] = useState({
    age: '',
    gender: 'male',
    hrMax: '',
    hrRest: '',
  });
  
  const [hrMode, setHrMode] = useState('auto');
  const [customHrZones, setCustomHrZones] = useState({
    z1Upper: 60,
    z2Upper: 70,
    z3Upper: 80,
    z4Upper: 90,
    z5Upper: 100
  });
  
  const [performance, setPerformance] = useState({
    distance: '5',
    hours: '0',
    minutes: '25',
    seconds: '0',
    avgHr: '',
    isRace: true
  });
  const [goal, setGoal] = useState({
    distance: '10',
    targetHours: '',
    targetMinutes: '',
    targetSeconds: '',
    prepWeeks: '12',
    daysPerWeek: '4',
    maxWeeklyKm: '40'
  });
  const [result, setResult] = useState(null);

  const calculateHrZones = () => {
    if (!profile.hrMax || !profile.hrRest) return null;
    const max = parseInt(profile.hrMax);
    const rest = parseInt(profile.hrRest);
    const reserve = max - rest;
    
    if (hrMode === 'manual') {
      return {
        z1: { 
          min: Math.round(rest + reserve * 0.5), 
          max: Math.round(rest + reserve * (customHrZones.z1Upper / 100)) 
        },
        z2: { 
          min: Math.round(rest + reserve * (customHrZones.z1Upper / 100)), 
          max: Math.round(rest + reserve * (customHrZones.z2Upper / 100)) 
        },
        z3: { 
          min: Math.round(rest + reserve * (customHrZones.z2Upper / 100)), 
          max: Math.round(rest + reserve * (customHrZones.z3Upper / 100)) 
        },
        z4: { 
          min: Math.round(rest + reserve * (customHrZones.z3Upper / 100)), 
          max: Math.round(rest + reserve * (customHrZones.z4Upper / 100)) 
        },
        z5: { 
          min: Math.round(rest + reserve * (customHrZones.z4Upper / 100)), 
          max: Math.round(rest + reserve * (customHrZones.z5Upper / 100)) 
        }
      };
    } else {
      return {
        z1: { min: Math.round(rest + reserve * 0.5), max: Math.round(rest + reserve * 0.6) },
        z2: { min: Math.round(rest + reserve * 0.6), max: Math.round(rest + reserve * 0.7) },
        z3: { min: Math.round(rest + reserve * 0.7), max: Math.round(rest + reserve * 0.8) },
        z4: { min: Math.round(rest + reserve * 0.8), max: Math.round(rest + reserve * 0.9) },
        z5: { min: Math.round(rest + reserve * 0.9), max: Math.round(rest + reserve * 1.0) }
      };
    }
  };

  const predictTime = (currentDist, currentTime, targetDist, fatigueK = 1.06) => {
    return currentTime * Math.pow(targetDist / currentDist, fatigueK);
  };

  const evaluateFeasibility = () => {
    const currentDist = parseFloat(performance.distance);
    const currentTime = parseInt(performance.hours) * 3600 + parseInt(performance.minutes) * 60 + parseInt(performance.seconds);
    const targetDist = parseFloat(goal.distance);
    const prepWeeks = parseInt(goal.prepWeeks);
    const maxWeeklyKm = parseInt(goal.maxWeeklyKm);
    
    const predictedTime = predictTime(currentDist, currentTime, targetDist);
    
    let targetTime = null;
    if (goal.targetHours || goal.targetMinutes || goal.targetSeconds) {
      targetTime = (parseInt(goal.targetHours) || 0) * 3600 + 
                   (parseInt(goal.targetMinutes) || 0) * 60 + 
                   (parseInt(goal.targetSeconds) || 0);
    }
    
    if (!targetTime) {
      const improvement = prepWeeks >= 12 ? 0.95 : (prepWeeks >= 8 ? 0.97 : 0.98);
      targetTime = Math.round(predictedTime * improvement);
    }
    
    const requiredImprovement = ((predictedTime - targetTime) / predictedTime) * 100;
    
    let maxReasonableImprovement;
    if (prepWeeks >= 16) maxReasonableImprovement = 10;
    else if (prepWeeks >= 12) maxReasonableImprovement = 7;
    else if (prepWeeks >= 8) maxReasonableImprovement = 5;
    else maxReasonableImprovement = 3;
    
    const weeklyVolumeAdequate = maxWeeklyKm >= targetDist * 3;
    
    let feasibility;
    if (requiredImprovement <= maxReasonableImprovement && weeklyVolumeAdequate) {
      feasibility = 'feasible';
    } else if (requiredImprovement <= maxReasonableImprovement * 1.2) {
      feasibility = 'borderline';
    } else {
      feasibility = 'not_feasible';
    }
    
    const recommendedWeeks = feasibility === 'not_feasible' 
      ? Math.ceil(prepWeeks * (requiredImprovement / maxReasonableImprovement))
      : prepWeeks;
    
    const plan = generateTrainingPlan(currentDist, currentTime, targetDist, targetTime, prepWeeks, maxWeeklyKm);
    
    return {
      currentAbility: {
        predict5k: formatTime(predictTime(currentDist, currentTime, 5)),
        predict10k: formatTime(predictTime(currentDist, currentTime, 10)),
        predict21k: formatTime(predictTime(currentDist, currentTime, 21.1)),
        predict42k: formatTime(predictTime(currentDist, currentTime, 42.2))
      },
      feasibility,
      requiredImprovement: requiredImprovement.toFixed(1),
      maxReasonableImprovement,
      recommendedWeeks,
      targetTime,
      predictedTime,
      plan,
      nutrition: generateNutrition(targetTime, targetDist)
    };
  };

  const calculateLSD = (weeklyKm, easyPaceMin, targetDist, weekNumber, totalWeeks) => {
    const byPercentage = weeklyKm * 0.28;
    const by150Min = 150 / easyPaceMin;
    const phase = weekNumber <= totalWeeks * 0.4 ? 'base' : 
                  weekNumber <= totalWeeks * 0.8 ? 'build' : 'taper';
    const raceMultiplier = phase === 'base' ? 0.7 : phase === 'build' ? 1.0 : 0.5;
    const byRaceLimit = targetDist * 1.2 * raceMultiplier;
    
    let lsdKm = Math.min(byPercentage, by150Min, byRaceLimit);
    const isRecoveryWeek = weekNumber % 4 === 0;
    if (isRecoveryWeek) {
      lsdKm = lsdKm * 0.8;
    }
    
    return Math.round(lsdKm * 10) / 10;
  };

  const generateTrainingPlan = (currentDist, currentTime, targetDist, targetTime, weeks, maxWeeklyKm) => {
    const daysPerWeek = parseInt(goal.daysPerWeek);
    const targetPace = targetTime / 60 / targetDist;
    const easyPace = targetPace * 1.25;
    const tempoPace = targetPace * 1.1;
    const intervalPace = targetPace * 0.95;
    
    const zones = calculateHrZones();
    
    const plan = [];
    const baseWeeks = Math.floor(weeks * 0.4);
    const buildWeeks = Math.floor(weeks * 0.4);
    
    for (let w = 1; w <= weeks; w++) {
      const phase = w <= baseWeeks ? 'Base' : w <= baseWeeks + buildWeeks ? 'Build' : 'Taper';
      
      const days = [];
      const weekProgress = w / weeks;
      const baseWeeklyKm = phase === 'Taper' ? maxWeeklyKm * 0.6 : 
                           20 + (weekProgress * (maxWeeklyKm - 20));
      const lsdKm = calculateLSD(baseWeeklyKm, easyPace, targetDist, w, weeks);
      const lsdTime = Math.round(lsdKm * easyPace);
      
      days.push({
        day: '週日',
        type: 'LSD',
        distance: lsdKm,
        pace: easyPace.toFixed(2),
        duration: lsdTime,
        hr: zones ? `Zone 2 (${zones.z2.min}-${zones.z2.max} bpm)` : 'Zone 2',
        description: `長距離慢跑 ${lsdKm}km @ ${easyPace.toFixed(2)} min/km`
      });
      
      if (daysPerWeek >= 4 && phase !== 'Taper') {
        const tempoKm = phase === 'Build' ? 8 : 6;
        days.push({
          day: '週三',
          type: 'Tempo',
          distance: tempoKm,
          pace: tempoPace.toFixed(2),
          duration: Math.round(tempoKm * tempoPace),
          hr: zones ? `Zone 3-4 (${zones.z3.min}-${zones.z4.max} bpm)` : 'Zone 3-4',
          description: `節奏跑 ${tempoKm}km @ ${tempoPace.toFixed(2)} min/km`
        });
      }
      
      if (daysPerWeek >= 5 && phase === 'Build') {
        const intervalKm = 6;
        days.push({
          day: '週五',
          type: 'Interval',
          distance: intervalKm,
          pace: intervalPace.toFixed(2),
          duration: 45,
          hr: zones ? `Zone 4-5 (${zones.z4.min}-${zones.z5.max} bpm)` : 'Zone 4-5',
          description: `間歇訓練 6x800m @ ${intervalPace.toFixed(2)} min/km (休息 400m 慢跑)`
        });
      }
      
      const remainingDays = daysPerWeek - days.length;
      const easyKm = phase === 'Taper' ? 5 : 6;
      
      for (let i = 0; i < remainingDays; i++) {
        days.push({
          day: `週${['一', '二', '四', '六'][i] || '?'}`,
          type: 'Easy',
          distance: easyKm,
          pace: easyPace.toFixed(2),
          duration: Math.round(easyKm * easyPace),
          hr: zones ? `Zone 2 (${zones.z2.min}-${zones.z2.max} bpm)` : 'Zone 2',
          description: `輕鬆跑 ${easyKm}km`
        });
      }
      
      const actualWeeklyKm = days.reduce((sum, day) => sum + day.distance, 0);
      const lsdPercentage = (lsdKm / actualWeeklyKm * 100).toFixed(1);
      
      plan.push({
        week: w,
        phase,
        totalKm: actualWeeklyKm.toFixed(1),
        lsdKm: lsdKm.toFixed(1),
        lsdPercentage,
        days
      });
    }
    
    return plan;
  };

  const generateNutrition = (raceTimeSec, distanceKm) => {
    const hours = raceTimeSec / 3600;
    const minutes = raceTimeSec / 60;
    
    let strategy = [];
    let gelCount = 0;
    let waterCount = 0;
    
    if (minutes < 30) {
      strategy.push('賽前30-60分鐘攝取少量碳水(香蕉/能量棒)');
      strategy.push('賽前15分鐘可小口補水100-150ml');
      strategy.push('比賽過程無需補給');
      return {
        totalWater: 0,
        totalCarbs: 0,
        gelCount: 0,
        waterCount: 0,
        strategy: strategy.join(' | ')
      };
    } else if (minutes < 60) {
      strategy.push('賽前1小時攝取碳水30-50g');
      strategy.push('賽中約25-30分鐘時可小口補水100ml');
      waterCount = 1;
      return {
        totalWater: 100,
        totalCarbs: 0,
        gelCount: 0,
        waterCount: 1,
        strategy: strategy.join(' | ')
      };
    } else if (minutes < 90) {
      strategy.push('每20-25分鐘補水150-200ml');
      strategy.push('約45分鐘時補充能量膠1包(25g)');
      gelCount = 1;
      waterCount = Math.ceil(minutes / 23);
      return {
        totalWater: waterCount * 180,
        totalCarbs: 25,
        gelCount: 1,
        waterCount,
        strategy: strategy.join(' | ')
      };
    } else if (minutes < 150) {
      strategy.push('每20分鐘補水150-200ml');
      strategy.push('每30-35分鐘補充能量膠1包(25g)');
      gelCount = Math.floor(minutes / 33);
      waterCount = Math.ceil(minutes / 20);
      return {
        totalWater: waterCount * 180,
        totalCarbs: gelCount * 25,
        gelCount,
        waterCount,
        strategy: strategy.join(' | ')
      };
    } else {
      strategy.push('每15-20分鐘補水150-200ml(總量約400-600ml/小時)');
      strategy.push('每30分鐘補充能量膠1包(目標60g碳水/小時)');
      gelCount = Math.floor(minutes / 30);
      waterCount = Math.ceil(minutes / 18);
      return {
        totalWater: waterCount * 180,
        totalCarbs: gelCount * 25,
        gelCount,
        waterCount,
        strategy: strategy.join(' | ')
      };
    }
  };

  const formatTime = (seconds) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return `${h > 0 ? h + ':' : ''}${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleGenerate = () => {
    const evalResult = evaluateFeasibility();
    setResult(evalResult);
    setStep(5);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-6xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <div className="flex items-center gap-3 mb-2">
            <Activity className="w-8 h-8 text-indigo-600" />
            <h1 className="text-3xl font-bold text-gray-800">跑步訓練系統</h1>
          </div>
          <p className="text-gray-600">能力評估 × 可行性判斷 × 智慧課表生成</p>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <div className="flex justify-between items-center">
            {[
              { num: 1, label: '跑者檔案', icon: Heart },
              { num: 2, label: '成績紀錄', icon: TrendingUp },
              { num: 3, label: '訓練目標', icon: Target },
              { num: 4, label: '生成計畫', icon: Zap },
              { num: 5, label: '檢視結果', icon: Calendar }
            ].map(({ num, label, icon: Icon }) => (
              <div key={num} className="flex flex-col items-center">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                  step >= num ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-500'
                }`}>
                  {step > num ? <CheckCircle className="w-6 h-6" /> : <Icon className="w-6 h-6" />}
                </div>
                <span className="text-xs mt-2 text-gray-600">{label}</span>
              </div>
            ))}
          </div>
        </div>

        {step === 1 && (
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-2xl font-bold mb-6 text-gray-800">跑者檔案與心率設定</h2>
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div>
                <label className="block text-sm font-medium mb-2">年齡</label>
                <input
                  type="number"
                  className="w-full p-2 border rounded"
                  value={profile.age}
                  onChange={(e) => setProfile({...profile, age: e.target.value})}
                  placeholder="例: 30"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">性別</label>
                <select
                  className="w-full p-2 border rounded"
                  value={profile.gender}
                  onChange={(e) => setProfile({...profile, gender: e.target.value})}
                >
                  <option value="male">男</option>
                  <option value="female">女</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">最大心率 (HRmax)</label>
                <input
                  type="number"
                  className="w-full p-2 border rounded"
                  value={profile.hrMax}
                  onChange={(e) => setProfile({...profile, hrMax: e.target.value})}
                  placeholder="例: 190"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">安靜心率 (HRrest)</label>
                <input
                  type="number"
                  className="w-full p-2 border rounded"
                  value={profile.hrRest}
                  onChange={(e) => setProfile({...profile, hrRest: e.target.value})}
                  placeholder="例: 60"
                />
              </div>
            </div>

            {profile.hrMax && profile.hrRest && (
              <div className="mb-6">
                <div className="flex items-center gap-4 mb-4">
                  <label className="font-medium">心率區間設定模式：</label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      value="auto"
                      checked={hrMode === 'auto'}
                      onChange={(e) => setHrMode(e.target.value)}
                    />
                    <span>自動計算 (Karvonen)</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      value="manual"
                      checked={hrMode === 'manual'}
                      onChange={(e) => setHrMode(e.target.value)}
                    />
                    <span>手動設定</span>
                  </label>
                </div>

                {hrMode === 'manual' && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                    <h3 className="font-bold mb-3 flex items-center gap-2">
                      <Info className="w-5 h-5" />
                      自訂心率區間上限 (HRR%)
                    </h3>
                    <div className="grid grid-cols-5 gap-3">
                      {['z1Upper', 'z2Upper', 'z3Upper', 'z4Upper', 'z5Upper'].map((zone, idx) => (
                        <div key={zone}>
                          <label className="block text-xs font-medium mb-1">
                            Zone {idx + 1} 上限
                          </label>
                          <input
                            type="number"
                            min={idx === 0 ? 50 : customHrZones[`z${idx}Upper`]}
                            max={100}
                            className="w-full p-2 border rounded text-sm"
                            value={customHrZones[zone]}
                            onChange={(e) => setCustomHrZones({
                              ...customHrZones,
                              [zone]: parseInt(e.target.value)
                            })}
                          />
                          <span className="text-xs text-gray-500">{customHrZones[zone]}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="bg-indigo-50 p-4 rounded-lg">
                  <h3 className="font-bold mb-3">心率區間結果</h3>
                  <div className="grid grid-cols-5 gap-2 text-sm">
                    {Object.entries(calculateHrZones() || {}).map(([zone, {min, max}]) => (
                      <div key={zone} className="bg-white p-2 rounded text-center">
                        <div className="font-bold text-indigo-600">{zone.toUpperCase()}</div>
                        <div className="text-gray-600">{min}-{max}</div>
                        <div className="text-xs text-gray-500">bpm</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <button
              onClick={() => setStep(2)}
              className="w-full bg-indigo-600 text-white py-3 rounded-lg font-bold hover:bg-indigo-700"
            >
              下一步：輸入成績
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-2xl font-bold mb-6 text-gray-800">近期最佳成績</h2>
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div>
                <label className="block text-sm font-medium mb-2">距離 (公里)</label>
                <select
                  className="w-full p-2 border rounded"
                  value={performance.distance}
                  onChange={(e) => setPerformance({...performance, distance: e.target.value})}
                >
                  <option value="3">3K</option>
                  <option value="5">5K</option>
                  <option value="10">10K</option>
                  <option value="21.1">半馬 (21.1K)</option>
                  <option value="42.2">全馬 (42.2K)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">成績類型</label>
                <select
                  className="w-full p-2 border rounded"
                  value={performance.isRace}
                  onChange={(e) => setPerformance({...performance, isRace: e.target.value === 'true'})}
                >
                  <option value="true">比賽成績</option>
                  <option value="false">訓練成績</option>
                </select>
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium mb-2">完成時間</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  className="w-20 p-2 border rounded"
                  value={performance.hours}
                  onChange={(e) => setPerformance({...performance, hours: e.target.value})}
                  placeholder="時"
                />
                <span className="py-2">:</span>
                <input
                  type="number"
                  className="w-20 p-2 border rounded"
                  value={performance.minutes}
                  onChange={(e) => setPerformance({...performance, minutes: e.target.value})}
                  placeholder="分"
                />
                <span className="py-2">:</span>
                <input
                  type="number"
                  className="w-20 p-2 border rounded"
                  value={performance.seconds}
                  onChange={(e) => setPerformance({...performance, seconds: e.target.value})}
                  placeholder="秒"
                />
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setStep(1)}
                className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-lg font-bold hover:bg-gray-300"
              >
                上一步
              </button>
              <button
                onClick={() => setStep(3)}
                className="flex-1 bg-indigo-600 text-white py-3 rounded-lg font-bold hover:bg-indigo-700"
              >
                下一步：設定目標
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-2xl font-bold mb-6 text-gray-800">訓練目標與限制</h2>
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div>
                <label className="block text-sm font-medium mb-2">目標距離</label>
                <select
                  className="w-full p-2 border rounded"
                  value={goal.distance}
                  onChange={(e) => setGoal({...goal, distance: e.target.value})}
                >
                  <option value="5">5K</option>
                  <option value="10">10K</option>
                  <option value="21.1">半馬</option>
                  <option value="42.2">全馬</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">準備週數</label>
                <input
                  type="number"
                  className="w-full p-2 border rounded"
                  value={goal.prepWeeks}
                  onChange={(e) => setGoal({...goal, prepWeeks: e.target.value})}
                  placeholder="例: 12"
                />
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium mb-2">目標時間 (選填，留空則系統建議)</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  className="w-20 p-2 border rounded"
                  value={goal.targetHours}
                  onChange={(e) => setGoal({...goal, targetHours: e.target.value})}
                  placeholder="時"
                />
                <span className="py-2">:</span>
                <input
                  type="number"
                  className="w-20 p-2 border rounded"
                  value={goal.targetMinutes}
                  onChange={(e) => setGoal({...goal, targetMinutes: e.target.value})}
                  placeholder="分"
                />
                <span className="py-2">:</span>
                <input
                  type="number"
                  className="w-20 p-2 border rounded"
                  value={goal.targetSeconds}
                  onChange={(e) => setGoal({...goal, targetSeconds: e.target.value})}
                  placeholder="秒"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6">
              <div>
                <label className="block text-sm font-medium mb-2">每週可跑天數</label>
                <select
                  className="w-full p-2 border rounded"
                  value={goal.daysPerWeek}
                  onChange={(e) => setGoal({...goal, daysPerWeek: e.target.value})}
                >
                  <option value="3">3 天</option>
                  <option value="4">4 天</option>
                  <option value="5">5 天</option>
                  <option value="6">6 天</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">最大週跑量 (公里)</label>
                <input
                  type="number"
                  className="w-full p-2 border rounded"
                  value={goal.maxWeeklyKm}
                  onChange={(e) => setGoal({...goal, maxWeeklyKm: e.target.value})}
                  placeholder="例: 40"
                />
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setStep(2)}
                className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-lg font-bold hover:bg-gray-300"
              >
                上一步
              </button>
              <button
                onClick={() => setStep(4)}
                className="flex-1 bg-indigo-600 text-white py-3 rounded-lg font-bold hover:bg-indigo-700"
              >
                下一步：生成計畫
              </button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-2xl font-bold mb-6 text-gray-800">確認資料並生成計畫</h2>
            
            <div className="space-y-4 mb-6">
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="font-bold mb-2">跑者檔案</h3>
                <p>年齡: {profile.age || '未填'} | 性別: {profile.gender === 'male' ? '男' : '女'}</p>
                {profile.hrMax && <p>心率: HRmax {profile.hrMax} / HRrest {profile.hrRest} ({hrMode === 'auto' ? 'Karvonen自動' : '手動設定'})</p>}
              </div>

              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="font-bold mb-2">目前能力</h3>
                <p>{performance.distance}K 成績: {performance.hours}:{performance.minutes}:{performance.seconds}</p>
              </div>

              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="font-bold mb-2">訓練目標</h3>
                <p>目標距離: {goal.distance}K</p>
                <p>準備週數: {goal.prepWeeks} 週</p>
                <p>每週 {goal.daysPerWeek} 天，最大週跑量 {goal.maxWeeklyKm}K</p>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setStep(3)}
                className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-lg font-bold hover:bg-gray-300"
              >
                上一步
              </button>
              <button
                onClick={handleGenerate}
                className="flex-1 bg-indigo-600 text-white py-3 rounded-lg font-bold hover:bg-indigo-700"
              >
                生成訓練計畫
              </button>
            </div>
          </div>
        )}

        {step === 5 && result && (
          <div className="space-y-6">
            <div className={`rounded-lg shadow-lg p-6 ${
              result.feasibility === 'feasible' ? 'bg-green-50 border-2 border-green-500' :
              result.feasibility === 'borderline' ? 'bg-yellow-50 border-2 border-yellow-500' :
              'bg-red-50 border-2 border-red-500'
            }`}>
              <div className="flex items-center gap-3 mb-4">
                {result.feasibility === 'feasible' ? (
                  <CheckCircle className="w-10 h-10 text-green-600" />
                ) : (
                  <AlertCircle className="w-10 h-10 text-red-600" />
                )}
                <div>
                  <h2 className="text-2xl font-bold">
                    {result.feasibility === 'feasible' ? '✓ 目標可行' :
                     result.feasibility === 'borderline' ? '⚠ 邊界可行' :
                     '✗ 目標過於激進'}
                  </h2>
                  <p className="text-gray-600">
                    需要進步 {result.requiredImprovement}% | 合理上限 {result.maxReasonableImprovement}%
                  </p>
                </div>
              </div>

              {result.feasibility !== 'feasible' && (
                <div className="bg-white p-4 rounded-lg">
                  <p className="font-bold mb-2">建議方案：</p>
                  <p>• 建議準備時間：{result.recommendedWeeks} 週</p>
                  <p>• 或調整目標成績為：{formatTime(result.predictedTime * 0.97)}</p>
                </div>
              )}
            </div>

            <div className="bg-white rounded-lg shadow-lg p-6">
              <h3 className="text-xl font-bold mb-4">目前能力評估</h3>
              <div className="grid grid-cols-4 gap-4">
                <div className="bg-indigo-50 p-4 rounded-lg text-center">
                  <div className="text-2xl font-bold text-indigo-600">{result.currentAbility.predict5k}</div>
                  <div className="text-sm text-gray-600">5K 預測</div>
                </div>
                <div className="bg-indigo-50 p-4 rounded-lg text-center">
                  <div className="text-2xl font-bold text-indigo-600">{result.currentAbility.predict10k}</div>
                  <div className="text-sm text-gray-600">10K 預測</div>
                </div>
                <div className="bg-indigo-50 p-4 rounded-lg text-center">
                  <div className="text-2xl font-bold text-indigo-600">{result.currentAbility.predict21k}</div>
                  <div className="text-sm text-gray-600">半馬 預測</div>
                </div>
                <div className="bg-indigo-50 p-4 rounded-lg text-center">
                  <div className="text-2xl font-bold text-indigo-600">{result.currentAbility.predict42k}</div>
                  <div className="text-sm text-gray-600">全馬 預測</div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-lg p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold">完整訓練計畫 ({result.plan.length} 週)</h3>
                <div className="bg-blue-50 px-4 py-2 rounded-lg">
                  <p className="text-sm font-bold text-blue-700">LSD 規則說明</p>
                  <p className="text-xs text-gray-600">取最小值: ① 週跑量28% ② 150分鐘上限 ③ 目標賽事1.2倍</p>
                </div>
              </div>
              <div className="space-y-4 max-h-[600px] overflow-y-auto">
                {result.plan.map((week) => (
                  <div key={week.week} className="border rounded-lg p-4">
                    <div className="flex justify-between items-center mb-3">
                      <h4 className="font-bold">第 {week.week} 週 - {week.phase}</h4>
                      <div className="flex gap-2">
                        <span className="bg-indigo-100 px-3 py-1 rounded-full text-sm">
                          週跑量: {week.totalKm}K
                        </span>
                        <span className="bg-blue-100 px-3 py-1 rounded-full text-sm">
                          LSD: {week.lsdKm}K ({week.lsdPercentage}%)
                        </span>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 gap-2">
                      {week.days.map((day, idx) => (
                        <div key={idx} className="bg-gray-50 p-3 rounded">
                          <div className="flex justify-between items-start">
                            <div>
                              <span className="font-bold text-sm">{day.day}</span>
                              <span className={`ml-2 px-2 py-0.5 rounded text-xs ${
                                day.type === 'LSD' ? 'bg-blue-100 text-blue-700' :
                                day.type === 'Tempo' ? 'bg-orange-100 text-orange-700' :
                                day.type === 'Interval' ? 'bg-red-100 text-red-700' :
                                'bg-green-100 text-green-700'
                              }`}>
                                {day.type}
                              </span>
                            </div>
                            <div className="text-right text-sm">
                              <div>{day.distance}K @ {day.pace} min/km</div>
                              <div className="text-gray-500 text-xs">{day.hr}</div>
                            </div>
                          </div>
                          <p className="text-sm text-gray-600 mt-1">{day.description}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-lg p-6">
              <h3 className="text-xl font-bold mb-4">賽事補給策略</h3>
              <div className="bg-blue-50 p-4 rounded-lg mb-4">
                <p className="font-bold mb-2">預估完賽時間: {formatTime(result.targetTime)}</p>
                <p className="text-sm text-gray-700">根據目標時間量身打造的補給建議</p>
              </div>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">{result.nutrition.totalWater} ml</div>
                  <div className="text-sm text-gray-600">總補水量 ({result.nutrition.waterCount} 次)</div>
                </div>
                <div className="bg-orange-50 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-orange-600">{result.nutrition.totalCarbs} g</div>
                  <div className="text-sm text-gray-600">總碳水 ({result.nutrition.gelCount} 包能量膠)</div>
                </div>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="font-bold mb-2">執行策略：</p>
                <p className="text-gray-700">{result.nutrition.strategy}</p>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setStep(1)}
                className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-lg font-bold hover:bg-gray-300"
              >
                重新開始
              </button>
              <button
                onClick={() => alert('匯出功能開發中 (可產出 CSV/PDF/ICS 格式)')}
                className="flex-1 bg-indigo-600 text-white py-3 rounded-lg font-bold hover:bg-indigo-700"
              >
                匯出完整計畫
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default RunningTrainingSystem;