import React, { useState } from 'react';
import { Activity, Heart, Target, Calendar, AlertCircle, CheckCircle, TrendingUp, Zap } from 'lucide-react';

const RunningTrainingSystem = () => {
  const [step, setStep] = useState(1);
  const [profile, setProfile] = useState({
    age: '',
    gender: 'male',
    hrMax: '',
    hrRest: '',
  });
  const [hrZones, setHrZones] = useState({
    z1: { min: 50, max: 60 },
    z2: { min: 60, max: 70 },
    z3: { min: 70, max: 80 },
    z4: { min: 80, max: 90 },
    z5: { min: 90, max: 100 }
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

  // 計算心率區間
  const calculateHrZones = () => {
    if (!profile.hrMax || !profile.hrRest) return null;
    const max = parseInt(profile.hrMax);
    const rest = parseInt(profile.hrRest);
    const reserve = max - rest;
    
    return {
      z1: { min: Math.round(rest + reserve * 0.5), max: Math.round(rest + reserve * 0.6) },
      z2: { min: Math.round(rest + reserve * 0.6), max: Math.round(rest + reserve * 0.7) },
      z3: { min: Math.round(rest + reserve * 0.7), max: Math.round(rest + reserve * 0.8) },
      z4: { min: Math.round(rest + reserve * 0.8), max: Math.round(rest + reserve * 0.9) },
      z5: { min: Math.round(rest + reserve * 0.9), max: Math.round(rest + reserve * 1.0) }
    };
  };

  // Riegel 公式跨距離推估
  const predictTime = (currentDist, currentTime, targetDist, fatigueK = 1.06) => {
    return currentTime * Math.pow(targetDist / currentDist, fatigueK);
  };

  // 可行性評估引擎
  const evaluateFeasibility = () => {
    const currentDist = parseFloat(performance.distance);
    const currentTime = parseInt(performance.hours) * 3600 + parseInt(performance.minutes) * 60 + parseInt(performance.seconds);
    const targetDist = parseFloat(goal.distance);
    const prepWeeks = parseInt(goal.prepWeeks);
    const maxWeeklyKm = parseInt(goal.maxWeeklyKm);
    
    // 預測目標距離的當前能力
    const predictedTime = predictTime(currentDist, currentTime, targetDist);
    
    // 目標時間 (如果有填)
    let targetTime = null;
    if (goal.targetHours || goal.targetMinutes || goal.targetSeconds) {
      targetTime = (parseInt(goal.targetHours) || 0) * 3600 + 
                   (parseInt(goal.targetMinutes) || 0) * 60 + 
                   (parseInt(goal.targetSeconds) || 0);
    }
    
    // 如果沒填目標時間，建議一個合理範圍
    if (!targetTime) {
      const improvement = prepWeeks >= 12 ? 0.95 : (prepWeeks >= 8 ? 0.97 : 0.98);
      targetTime = Math.round(predictedTime * improvement);
    }
    
    // 計算需要的進步幅度
    const requiredImprovement = ((predictedTime - targetTime) / predictedTime) * 100;
    
    // 根據準備週數估算合理進步上限
    let maxReasonableImprovement;
    if (prepWeeks >= 16) maxReasonableImprovement = 10;
    else if (prepWeeks >= 12) maxReasonableImprovement = 7;
    else if (prepWeeks >= 8) maxReasonableImprovement = 5;
    else maxReasonableImprovement = 3;
    
    // 週跑量檢查
    const weeklyVolumeAdequate = maxWeeklyKm >= targetDist * 3;
    
    // 可行性判斷
    let feasibility;
    if (requiredImprovement <= maxReasonableImprovement && weeklyVolumeAdequate) {
      feasibility = 'feasible';
    } else if (requiredImprovement <= maxReasonableImprovement * 1.2) {
      feasibility = 'borderline';
    } else {
      feasibility = 'not_feasible';
    }
    
    // 建議週數
    const recommendedWeeks = feasibility === 'not_feasible' 
      ? Math.ceil(prepWeeks * (requiredImprovement / maxReasonableImprovement))
      : prepWeeks;
    
    // 產生訓練計畫
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

  // LSD 引擎
  const calculateLSD = (weeklyKm, easyPaceMin, targetDist, weekNumber, totalWeeks) => {
    // 規則1: 週跑量的 25-30%
    const byPercentage = weeklyKm * 0.28;
    
    // 規則2: 150 分鐘上限
    const by150Min = easyPaceMin * 150 / 60;
    
    // 規則3: 目標賽事 1.2 倍上限 (在 Build 期才接近)
    const phase = weekNumber <= totalWeeks * 0.4 ? 'base' : 
                  weekNumber <= totalWeeks * 0.8 ? 'build' : 'taper';
    const raceMultiplier = phase === 'base' ? 0.7 : phase === 'build' ? 1.0 : 0.5;
    const byRaceLimit = targetDist * 1.2 * raceMultiplier;
    
    // 取最小值
    const lsdKm = Math.min(byPercentage, by150Min, byRaceLimit);
    
    // 漸進原則: 每週 +5-10%, 每第4週 -20%
    const isRecoveryWeek = weekNumber % 4 === 0;
    const progressionFactor = isRecoveryWeek ? 0.8 : 1.0;
    
    return Math.round(lsdKm * progressionFactor * 10) / 10;
  };

  // 訓練計畫生成器
  const generateTrainingPlan = (currentDist, currentTime, targetDist, targetTime, weeks, maxWeeklyKm) => {
    const daysPerWeek = parseInt(goal.daysPerWeek);
    const targetPace = targetTime / 60 / targetDist; // min/km
    const easyPace = targetPace * 1.25;
    const tempoPace = targetPace * 1.1;
    const intervalPace = targetPace * 0.95;
    
    const plan = [];
    const baseWeeks = Math.floor(weeks * 0.4);
    const buildWeeks = Math.floor(weeks * 0.4);
    const taperWeeks = weeks - baseWeeks - buildWeeks;
    
    for (let w = 1; w <= weeks; w++) {
      const phase = w <= baseWeeks ? 'Base' : w <= baseWeeks + buildWeeks ? 'Build' : 'Taper';
      const weeklyKm = phase === 'Taper' ? maxWeeklyKm * 0.6 : 
                       Math.min(maxWeeklyKm, 20 + (w / weeks) * (maxWeeklyKm - 20));
      
      const lsdKm = calculateLSD(weeklyKm, easyPace, targetDist, w, weeks);
      const lsdTime = Math.round(lsdKm * easyPace);
      
      const days = [];
      
      // 週日: LSD
      days.push({
        day: '週日',
        type: 'LSD',
        distance: lsdKm,
        pace: easyPace.toFixed(2),
        duration: lsdTime,
        hr: 'Zone 2',
        description: `長距離慢跑 ${lsdKm}km，配速 ${easyPace.toFixed(2)} min/km`
      });
      
      if (daysPerWeek >= 4 && phase !== 'Taper') {
        // 週三: Tempo 或 Threshold
        const tempoKm = phase === 'Build' ? 8 : 6;
        days.push({
          day: '週三',
          type: 'Tempo',
          distance: tempoKm,
          pace: tempoPace.toFixed(2),
          duration: Math.round(tempoKm * tempoPace),
          hr: 'Zone 3-4',
          description: `節奏跑 ${tempoKm}km，配速 ${tempoPace.toFixed(2)} min/km`
        });
      }
      
      if (daysPerWeek >= 5 && phase === 'Build') {
        // 週五: Intervals
        const intervalSets = w > baseWeeks + buildWeeks / 2 ? '6×800m' : '5×1000m';
        days.push({
          day: '週五',
          type: 'Interval',
          distance: 6,
          pace: intervalPace.toFixed(2),
          duration: 45,
          hr: 'Zone 4-5',
          description: `間歇訓練 ${intervalSets}，配速 ${intervalPace.toFixed(2)} min/km，休息 400m 慢跑`
        });
      }
      
      // 填充 Easy runs
      const remainingDays = daysPerWeek - days.length;
      for (let i = 0; i < remainingDays; i++) {
        const easyKm = 6;
        days.push({
          day: `週${['一', '二', '四', '六'][i]}`,
          type: 'Easy',
          distance: easyKm,
          pace: easyPace.toFixed(2),
          duration: Math.round(easyKm * easyPace),
          hr: 'Zone 2',
          description: `輕鬆跑 ${easyKm}km`
        });
      }
      
      plan.push({
        week: w,
        phase,
        totalKm: weeklyKm.toFixed(1),
        days
      });
    }
    
    return plan;
  };

  // 補給策略
  const generateNutrition = (raceTimeSec, distanceKm) => {
    const hours = raceTimeSec / 3600;
    const waterPerHour = 400; // ml
    const carbsPerHour = hours > 2 ? 60 : 30; // g
    
    return {
      totalWater: Math.round(waterPerHour * hours),
      totalCarbs: Math.round(carbsPerHour * hours),
      strategy: hours > 2.5 
        ? `每 5km 補水 200ml + 每 30 分鐘補充能量膠 1 包 (25g 碳水)`
        : `每 20-25 分鐘小口補水，賽程過半後可補充能量膠`
    };
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

  const zones = calculateHrZones() || hrZones;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <div className="flex items-center gap-3 mb-2">
            <Activity className="w-8 h-8 text-indigo-600" />
            <h1 className="text-3xl font-bold text-gray-800">跑步訓練系統</h1>
          </div>
          <p className="text-gray-600">能力評估 × 可行性判斷 × 智慧課表生成</p>
        </div>

        {/* Progress Steps */}
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

        {/* Step 1: Profile */}
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
              <div className="bg-indigo-50 p-4 rounded-lg mb-6">
                <h3 className="font-bold mb-3">心率區間 (Karvonen 公式)</h3>
                <div className="grid grid-cols-5 gap-2 text-sm">
                  {Object.entries(zones).map(([zone, {min, max}]) => (
                    <div key={zone} className="bg-white p-2 rounded text-center">
                      <div className="font-bold text-indigo-600">{zone.toUpperCase()}</div>
                      <div className="text-gray-600">{min}-{max} bpm</div>
                    </div>
                  ))}
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

        {/* Step 2: Performance */}
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

            <div className="mb-6">
              <label className="block text-sm font-medium mb-2">平均心率 (選填)</label>
              <input
                type="number"
                className="w-full p-2 border rounded"
                value={performance.avgHr}
                onChange={(e) => setPerformance({...performance, avgHr: e.target.value})}
                placeholder="例: 165"
              />
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

        {/* Step 3: Goal */}
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

        {/* Step 4: Generate */}
        {step === 4 && (
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-2xl font-bold mb-6 text-gray-800">確認資料並生成計畫</h2>
            
            <div className="space-y-4 mb-6">
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="font-bold mb-2">跑者檔案</h3>
                <p>年齡: {profile.age || '未填'} | 性別: {profile.gender === 'male' ? '男' : '女'}</p>
                {profile.hrMax && <p>心率區間: HRmax {profile.hrMax} / HRrest {profile.hrRest}</p>}
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

        {/* Step 5: Results */}
        {step === 5 && result && (
          <div className="space-y-6">
            {/* Feasibility Card */}
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

            {/* Current Ability */}
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

            {/* Training Plan */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h3 className="text-xl font-bold mb-4">完整訓練計畫 ({result.plan.length} 週)</h3>
              <div className="space-y-4 max-h-[600px] overflow-y-auto">
                {result.plan.map((week) => (
                  <div key={week.week} className="border rounded-lg p-4">
                    <div className="flex justify-between items-center mb-3">
                      <h4 className="font-bold">第 {week.week} 週 - {week.phase}</h4>
                      <span className="bg-indigo-100 px-3 py-1 rounded-full text-sm">
                        週跑量: {week.totalKm}K
                      </span>
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

            {/* Nutrition */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h3 className="text-xl font-bold mb-4">賽事補給策略</h3>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">{result.nutrition.totalWater} ml</div>
                  <div className="text-sm text-gray-600">總補水量</div>
                </div>
                <div className="bg-orange-50 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-orange-600">{result.nutrition.totalCarbs} g</div>
                  <div className="text-sm text-gray-600">總碳水化合物</div>
                </div>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="font-bold mb-2">執行策略：</p>
                <p className="text-gray-700">{result.nutrition.strategy}</p>
              </div>
            </div>

            {/* Action Buttons */}
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