(function () {
  const asset = (name) => `../assets/yoyo/home/${name}.webp`;

  window.YOYO_HOME_SCENE = {
    roomLayout: {
      baseAsset: asset('room-shell-clean-2d'),
      designSize: { width: 1080, height: 720 },
      slots: {
        feed: { left: '9%', bottom: '31%', width: '190px', zIndex: 5, semantic: 'meal-table' },
        bath: { right: '9%', bottom: '29%', width: '235px', zIndex: 5, semantic: 'wash-stand' },
        sleep: { right: '10%', bottom: '22%', width: '305px', zIndex: 5, semantic: 'child-bed' },
        play: { left: '7%', bottom: '28%', width: '220px', zIndex: 5, semantic: 'toy-shelf' },
        pet: { right: '23%', bottom: '28%', width: '200px', zIndex: 5, semantic: 'companionship-spot' },
      },
    },
    petPlacements: {
      default: { left: '50%', bottom: '88px', scale: 0.72 },
      feed: { left: '27%', bottom: '175px', scale: 0.58 },
      bath: { left: '75%', bottom: '180px', scale: 0.54 },
      sleep: { left: '65%', bottom: '268px', scale: 0.70 },
      play: { left: '20%', bottom: '205px', scale: 0.58 },
      pet: { left: '61%', bottom: '170px', scale: 0.64 },
    },
    specialPoses: {
      sleep: {
        objectId: 'sleepBed',
        src: asset('home-sleep-yoyo'),
      },
    },
    actionComposites: {
      feed: {
        objectId: 'foodBowl',
        semantic: 'meal-table-eating',
        src: asset('composite-feed-table-yoyo'),
      },
      bath: {
        objectId: 'bathTub',
        semantic: 'wash-stand-hands',
        src: asset('composite-bath-wash-yoyo'),
      },
      sleep: {
        objectId: 'sleepBed',
        semantic: 'child-bed-sleep',
        src: asset('composite-sleep-bed-yoyo'),
      },
      play: {
        objectId: 'toyBox',
        semantic: 'toy-shelf-play',
        src: asset('composite-play-toys-yoyo'),
      },
      pet: {
        objectId: 'heartSpot',
        semantic: 'cushion-head-pat',
        src: asset('composite-pet-cushion-yoyo'),
      },
    },
    actionRooms: {},
    decor: [
      {
        id: 'wallSoftFurnishing',
        src: asset('decor-wall-soft-furnishing'),
        slot: { left: '34%', bottom: '27%', width: '360px', zIndex: 4 },
        label: '墙边软装',
      },
      {
        id: 'tvGameToys',
        src: asset('decor-tv-game-toys'),
        slot: { right: '12%', bottom: '27%', width: '220px', zIndex: 4 },
        label: '电视游戏玩具区',
      },
    ],
    objects: [
      {
        id: 'foodBowl',
        action: 'feed',
        slot: 'feed',
        className: 'food-bowl-object',
        initialState: 'idle',
        label: '小餐桌',
        layers: [
          { id: 'back', className: 'food-bowl-back', src: asset('prop-food-back') },
          { id: 'mealFull', className: 'food-bowl-meal-full', src: asset('prop-food-meal-full') },
          { id: 'mealLow', className: 'food-bowl-meal-low', src: asset('prop-food-meal-low') },
          { id: 'front', className: 'food-bowl-front', src: asset('prop-food-front') },
        ],
      },
      {
        id: 'bathTub',
        action: 'bath',
        slot: 'bath',
        className: 'bath-tub-object',
        initialState: 'idle',
        label: '洗漱区',
        layers: [
          { id: 'back', className: 'bath-tub-back', src: asset('prop-bath-back') },
          { id: 'water', className: 'bath-tub-water', src: asset('prop-bath-water') },
          { id: 'bubbles', className: 'bath-tub-bubbles', src: asset('prop-bath-bubbles') },
          { id: 'front', className: 'bath-tub-front', src: asset('prop-bath-front') },
        ],
      },
      {
        id: 'sleepBed',
        action: 'sleep',
        slot: 'sleep',
        className: 'sleep-bed-object',
        initialState: 'idle',
        label: 'Yoyo的小床',
        layers: [
          { id: 'back', className: 'sleep-bed-back', src: asset('prop-bed-back') },
          { id: 'blanket', className: 'sleep-bed-blanket', src: asset('prop-bed-blanket') },
          { id: 'front', className: 'sleep-bed-front', src: asset('prop-bed-front') },
        ],
      },
      {
        id: 'toyBox',
        action: 'play',
        slot: 'play',
        className: 'toy-box-object',
        initialState: 'idle',
        label: '玩具架',
        layers: [
          { id: 'back', className: 'toy-box-back', src: asset('prop-toy-back') },
          { id: 'toys', className: 'toy-box-toys', src: asset('prop-toy-burst') },
          { id: 'front', className: 'toy-box-front', src: asset('prop-toy-front') },
        ],
      },
      {
        id: 'heartSpot',
        action: 'pet',
        slot: 'pet',
        className: 'heart-spot-object',
        initialState: 'idle',
        label: '陪伴位置',
        layers: [
          { id: 'back', className: 'heart-spot-back', src: asset('prop-heart-back') },
          { id: 'pulse', className: 'heart-spot-pulse', src: asset('prop-heart-pulse') },
          { id: 'front', className: 'heart-spot-front', src: asset('prop-heart-front') },
        ],
      },
    ],
    interactions: {
      feed: {
        objectId: 'foodBowl',
        phases: [
          { at: 0, state: 'full', stagePhase: 'approach' },
          { at: 650, state: 'eating', stagePhase: 'active' },
          { at: 4300, state: 'done', stagePhase: 'satisfied' },
        ],
        resetDelay: 6200,
      },
      bath: {
        objectId: 'bathTub',
        phases: [
          { at: 0, state: 'ready', stagePhase: 'approach' },
          { at: 650, state: 'bathing', stagePhase: 'active' },
          { at: 4300, state: 'done', stagePhase: 'satisfied' },
        ],
        resetDelay: 6200,
      },
      sleep: {
        objectId: 'sleepBed',
        phases: [
          { at: 0, state: 'open', stagePhase: 'approach' },
          { at: 650, state: 'resting', stagePhase: 'active' },
          { at: 4300, state: 'done', stagePhase: 'satisfied' },
        ],
        resetDelay: 6200,
      },
      play: {
        objectId: 'toyBox',
        phases: [
          { at: 0, state: 'ready', stagePhase: 'approach' },
          { at: 650, state: 'playing', stagePhase: 'active' },
          { at: 4300, state: 'done', stagePhase: 'satisfied' },
        ],
        resetDelay: 6200,
      },
      pet: {
        objectId: 'heartSpot',
        phases: [
          { at: 0, state: 'ready', stagePhase: 'approach' },
          { at: 650, state: 'petting', stagePhase: 'active' },
          { at: 4300, state: 'done', stagePhase: 'satisfied' },
        ],
        resetDelay: 6200,
      },
    },
  };
}());
