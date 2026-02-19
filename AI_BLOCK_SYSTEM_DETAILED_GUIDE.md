# Scratch-VM AI 积木系统详细文档

## 目录
1. [系统架构](#系统架构)
2. [核心概念](#核心概念)
3. [文件说明](#文件说明)
4. [数据流程](#数据流程)
5. [API 详解](#api-详解)
6. [使用示例](#使用示例)
7. [事件系统](#事件系统)
8. [集成指南](#集成指南)

---

## 系统架构

### 整体设计

```
┌─────────────────────────────────────────────────────────────┐
│                        GUI 层 (Blockly)                      │
│                   用户拖拽、创建、删除积木                    │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ↓
┌─────────────────────────────────────────────────────────────┐
│                   VirtualMachine (VM)                        │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  aiBlockGenerator (公共 API)                         │   │
│  │  - createBlock()                                     │   │
│  │  - deleteBlock()                                     │   │
│  │  - moveBlock()                                       │   │
│  │  - changeField()                                     │   │
│  └──────────────────────────────────────────────────────┘   │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ↓
┌─────────────────────────────────────────────────────────────┐
│                    Blocks 容器                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  blocklyListen(event)                                │   │
│  │  - 接收 Blockly 事件                                 │   │
│  │  - 调用 AI 中间层处理                                │   │
│  │  - 处理事件                                          │   │
│  └──────────────────────────────────────────────────────┘   │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ↓
┌─────────────────────────────────────────────────────────────┐
│              AIBlockDecider (AI 中间层)                      │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  process(event)                                      │   │
│  │  - 拦截事件                                         │   │
│  │  - 调用决策处理器                                    │   │
│  │  - 返回修改后的事件                                  │   │
│  └──────────────────────────────────────────────────────┘   │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ↓
┌─────────────────────────────────────────────────────────────┐
│              事件处理 (_processBlocklyEvent)                 │
│  - createBlock()                                             │
│  - deleteBlock()                                             │
│  - moveBlock()                                               │
│  - changeBlock()                                             │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ↓
┌─────────────────────────────────────────────────────────────┐
│                   Runtime 更新                               │
│  - 更新积木数据结构                                          │
│  - 发出 PROJECT_CHANGED 事件                                │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ↓
┌─────────────────────────────────────────────────────────────┐
│                   GUI 重新渲染                               │
│                  显示新的积木结构                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 核心概念

### 1. 事件驱动架构

Scratch-VM 使用事件驱动模式：
- **Blockly 事件** - 用户在 GUI 中的操作（创建、删除、移动、修改）
- **VM 事件** - 内部状态变化（积木创建、删除、连接等）
- **事件监听** - 各个模块监听并响应事件

### 2. AI 中间层的作用

AI 中间层在事件处理流程中插入一个决策点：

```
原始流程：
Blockly 事件 → 处理 → 更新 VM → 渲染

AI 中间层流程：
Blockly 事件 → AI 决策 → 修改/生成事件 → 处理 → 更新 VM → 渲染
```

### 3. 三层架构

| 层级 | 类 | 职责 |
|------|-----|------|
| 公共 API | AIBlockGenerator | 提供简单易用的方法给 GUI 调用 |
| 中间层 | AIBlockDecider | 拦截、修改、生成事件 |
| 底层 | Blocks | 处理事件，更新 VM 状态 |

---

## 文件说明

### 1. src/engine/ai-block-decider.js

**职责**：事件拦截和决策处理

**核心属性**：
```javascript
{
  enabled: boolean,              // 是否启用 AI
  decisionHandler: Function,     // 决策处理函数
  eventHistory: Array,           // 事件历史（最多 100 条）
  maxHistorySize: 100            // 历史记录最大数量
}
```

**核心方法**：
```javascript
enable()                         // 启用 AI 决策
disable()                        // 禁用 AI 决策
setDecisionHandler(handler)      // 设置决策处理函数
process(event, blocksContainer)  // 处理事件（自动调用）
getContext()                     // 获取上下文信息
clearHistory()                   // 清除事件历史
```

**静态方法**（事件生成）：
```javascript
createBlockEvent(...)            // 生成创建积木事件
deleteBlockEvent(...)            // 生成删除积木事件
moveBlockEvent(...)              // 生成移动积木事件
changeFieldEvent(...)            // 生成修改字段事件
```

### 2. src/engine/ai-block-generator.js

**职责**：提供公共 API 给 GUI 调用

**核心方法**：
```javascript
createBlock(targetId, opcode, options)      // 创建积木
deleteBlock(targetId, blockId)              // 删除积木
moveBlock(targetId, blockId, options)       // 移动积木
changeField(targetId, blockId, fieldName, newValue)  // 修改字段
createBlockSequence(targetId, blockConfigs) // 创建积木序列
enableAI(targetId, decisionHandler)         // 启用 AI
disableAI(targetId)                         // 禁用 AI
getEventHistory(targetId)                   // 获取事件历史
clearEventHistory(targetId)                 // 清除事件历史
```

### 3. src/engine/blocks.js

**修改点**：在 `blocklyListen()` 方法中集成 AI 中间层

**修改前**：
```javascript
blocklyListen(e) {
    // 直接处理事件
    this._processBlocklyEvent(e);
}
```

**修改后**：
```javascript
blocklyListen(e) {
    // 通过 AI 中间层处理
    const processedEvents = this.aiBlockDecider.process(e, this);
    
    // 处理返回的事件
    if (Array.isArray(processedEvents)) {
        for (const event of processedEvents) {
            this._processBlocklyEvent(event);
        }
    }
}
```

### 4. src/virtual-machine.js

**修改点**：在构造函数中初始化 AIBlockGenerator

```javascript
this.aiBlockGenerator = new AIBlockGenerator(this.runtime);
```

**暴露的 API**：
```javascript
vm.aiBlockGenerator.createBlock(...)
vm.aiBlockGenerator.deleteBlock(...)
vm.aiBlockGenerator.moveBlock(...)
vm.aiBlockGenerator.changeField(...)
```

---

## 数据流程

### 创建积木的完整流程

```
1. GUI 调用
   vm.aiBlockGenerator.createBlock('sprite_1', 'motion_movesteps', {
       fields: { STEPS: '10' },
       coordinates: { x: 100, y: 100 }
   })

2. AIBlockGenerator 生成事件
   event = {
       type: 'create',
       blockId: 'ai_block_xxx',
       opcode: 'motion_movesteps',
       fields: { STEPS: '10' },
       coordinates: { x: 100, y: 100 }
   }

3. 调用 blocklyListen()
   target.blocks.blocklyListen(event)

4. AIBlockDecider 拦截
   - 检查是否启用 AI
   - 调用决策处理函数
   - 返回修改后的事件数组

5. Blocks 处理事件
   - 调用 _processBlocklyEvent()
   - 根据事件类型调用相应方法
   - 创建积木对象
   - 添加到 _blocks 字典

6. Runtime 更新
   - 发出 PROJECT_CHANGED 事件
   - 触发 BLOCKS_NEED_UPDATE

7. GUI 重新渲染
   - 接收 workspaceUpdate 事件
   - 在 Blockly 中显示新积木
```

### 事件对象结构

#### 创建事件
```javascript
{
    type: 'create',
    blockId: 'block_123',
    opcode: 'motion_movesteps',
    fields: {
        STEPS: '10'
    },
    inputs: {
        // 输入连接
    },
    topLevel: true,
    coordinates: { x: 100, y: 100 }
}
```

#### 删除事件
```javascript
{
    type: 'delete',
    blockId: 'block_123'
}
```

#### 移动事件
```javascript
{
    type: 'move',
    blockId: 'block_123',
    newParent: 'block_parent',  // null 表示顶级
    newInput: 'SUBSTACK',        // null 表示 next 连接
    coordinates: { x: 200, y: 200 }
}
```

#### 修改事件
```javascript
{
    type: 'change',
    blockId: 'block_123',
    element: 'field',
    name: 'STEPS',
    newValue: '20'
}
```

---

## API 详解

### AIBlockGenerator API

#### createBlock(targetId, opcode, options)

创建单个积木。

**参数**：
- `targetId` (string) - 目标 ID（精灵或舞台）
- `opcode` (string) - 积木操作码（如 'motion_movesteps'）
- `options` (object) - 配置选项
  - `fields` (object) - 积木字段值
  - `inputs` (object) - 输入连接
  - `coordinates` (object) - 位置 {x, y}
  - `topLevel` (boolean) - 是否为顶级积木（默认 true）
  - `blockId` (string) - 自定义积木 ID（自动生成）

**返回值**：
- (string) 创建的积木 ID

**示例**：
```javascript
const blockId = vm.aiBlockGenerator.createBlock('sprite_1', 'motion_movesteps', {
    fields: { STEPS: '10' },
    coordinates: { x: 100, y: 100 }
});
console.log('Created block:', blockId);
```

#### deleteBlock(targetId, blockId)

删除指定积木。

**参数**：
- `targetId` (string) - 目标 ID
- `blockId` (string) - 要删除的积木 ID

**示例**：
```javascript
vm.aiBlockGenerator.deleteBlock('sprite_1', 'block_123');
```

#### moveBlock(targetId, blockId, options)

移动积木到新位置或改变连接。

**参数**：
- `targetId` (string) - 目标 ID
- `blockId` (string) - 要移动的积木 ID
- `options` (object) - 移动选项
  - `parentId` (string) - 新的父积木 ID（null 表示顶级）
  - `inputName` (string) - 父积木的输入名称（null 表示 next 连接）
  - `coordinates` (object) - 新位置 {x, y}

**示例**：
```javascript
vm.aiBlockGenerator.moveBlock('sprite_1', 'block_123', {
    parentId: 'block_parent',
    inputName: 'SUBSTACK',
    coordinates: { x: 200, y: 200 }
});
```

#### changeField(targetId, blockId, fieldName, newValue)

修改积木字段值。

**参数**：
- `targetId` (string) - 目标 ID
- `blockId` (string) - 积木 ID
- `fieldName` (string) - 字段名称
- `newValue` (*) - 新值

**示例**：
```javascript
vm.aiBlockGenerator.changeField('sprite_1', 'block_123', 'STEPS', '20');
```

#### createBlockSequence(targetId, blockConfigs)

创建一系列连接的积木。

**参数**：
- `targetId` (string) - 目标 ID
- `blockConfigs` (array) - 积木配置数组

**返回值**：
- (array) 创建的积木 ID 数组

**示例**：
```javascript
const blockIds = vm.aiBlockGenerator.createBlockSequence('sprite_1', [
    {
        opcode: 'motion_movesteps',
        fields: { STEPS: '10' }
    },
    {
        opcode: 'motion_turnright',
        fields: { ANGLE: '90' }
    },
    {
        opcode: 'motion_movesteps',
        fields: { STEPS: '10' }
    }
]);
```

#### enableAI(targetId, decisionHandler)

为目标启用 AI 决策。

**参数**：
- `targetId` (string) - 目标 ID
- `decisionHandler` (function) - 决策处理函数（可选）

**决策处理函数签名**：
```javascript
(event, blocksContainer, context) => {
    // event - 当前事件对象
    // blocksContainer - Blocks 容器
    // context - 上下文信息 { eventHistory, ... }
    
    // 返回事件数组
    return [event];  // 允许事件
    return [];       // 拒绝事件
    return [event1, event2];  // 修改或生成多个事件
}
```

**示例**：
```javascript
vm.aiBlockGenerator.enableAI('sprite_1', (event, blocksContainer, context) => {
    console.log('Event:', event.type);
    console.log('History:', context.eventHistory.length);
    return [event];
});
```

#### disableAI(targetId)

禁用 AI 决策。

**参数**：
- `targetId` (string) - 目标 ID

**示例**：
```javascript
vm.aiBlockGenerator.disableAI('sprite_1');
```

#### getEventHistory(targetId)

获取事件历史。

**参数**：
- `targetId` (string) - 目标 ID

**返回值**：
- (array) 事件历史数组

**示例**：
```javascript
const history = vm.aiBlockGenerator.getEventHistory('sprite_1');
console.log('Total events:', history.length);
history.forEach(event => {
    console.log(event.type, event.blockId);
});
```

#### clearEventHistory(targetId)

清除事件历史。

**参数**：
- `targetId` (string) - 目标 ID

**示例**：
```javascript
vm.aiBlockGenerator.clearEventHistory('sprite_1');
```

---

## 使用示例

### 示例 1：基础创建积木

```javascript
// 获取 VM 实例
const vm = new VirtualMachine();
vm.start();

// 加载项目
await vm.loadProject(projectData);

// 获取编辑中的目标
const targetId = vm.editingTarget.id;

// 创建一个 "移动 10 步" 的积木
const blockId = vm.aiBlockGenerator.createBlock(targetId, 'motion_movesteps', {
    fields: { STEPS: '10' },
    coordinates: { x: 100, y: 100 }
});

console.log('Created block:', blockId);
```

### 示例 2：创建积木序列

```javascript
// 创建一个简单的程序：向前走 10 步，转向 90 度，再走 10 步
const blockIds = vm.aiBlockGenerator.createBlockSequence(targetId, [
    {
        opcode: 'motion_movesteps',
        fields: { STEPS: '10' }
    },
    {
        opcode: 'motion_turnright',
        fields: { ANGLE: '90' }
    },
    {
        opcode: 'motion_movesteps',
        fields: { STEPS: '10' }
    }
]);

console.log('Created blocks:', blockIds);
```

### 示例 3：启用 AI 决策

```javascript
// 启用 AI，并设置决策处理器
vm.aiBlockGenerator.enableAI(targetId, (event, blocksContainer, context) => {
    // 记录所有事件
    console.log(`Event: ${event.type}, Block: ${event.blockId}`);
    
    // 阻止删除操作
    if (event.type === 'delete') {
        console.log('Delete blocked by AI');
        return [];  // 拒绝删除
    }
    
    // 允许其他操作
    return [event];
});

// 现在用户在 GUI 中的操作都会经过 AI 决策
```

### 示例 4：AI 生成积木

```javascript
vm.aiBlockGenerator.enableAI(targetId, (event, blocksContainer, context) => {
    // 当用户创建 "移动" 积木时，自动添加一个 "转向" 积木
    if (event.type === 'create' && event.opcode === 'motion_movesteps') {
        // 生成额外的积木
        const turnEvent = {
            type: 'create',
            blockId: `turn_${Date.now()}`,
            opcode: 'motion_turnright',
            fields: { ANGLE: '90' },
            topLevel: false,
            coordinates: { x: event.coordinates.x, y: event.coordinates.y + 50 }
        };
        
        // 返回两个事件
        return [event, turnEvent];
    }
    
    return [event];
});
```

### 示例 5：修改积木参数

```javascript
// 创建积木
const blockId = vm.aiBlockGenerator.createBlock(targetId, 'motion_movesteps', {
    fields: { STEPS: '10' }
});

// 修改参数
vm.aiBlockGenerator.changeField(targetId, blockId, 'STEPS', '20');

// 再次修改
vm.aiBlockGenerator.changeField(targetId, blockId, 'STEPS', '30');
```

### 示例 6：完整的 AI 控制器

```javascript
class AIBlockController {
    constructor(vm) {
        this.vm = vm;
        this.targetId = null;
        this.blockCount = 0;
    }

    initialize(targetId) {
        this.targetId = targetId;
        
        // 启用 AI
        this.vm.aiBlockGenerator.enableAI(targetId, (event, blocksContainer, context) => {
            return this.handleEvent(event, context);
        });
    }

    handleEvent(event, context) {
        console.log(`[AI] Event: ${event.type}, Block: ${event.blockId}`);
        
        switch (event.type) {
            case 'create':
                this.blockCount++;
                console.log(`[AI] Total blocks created: ${this.blockCount}`);
                
                // 限制最多创建 100 个积木
                if (this.blockCount > 100) {
                    console.log('[AI] Block limit reached');
                    return [];
                }
                break;
                
            case 'delete':
                this.blockCount--;
                break;
        }
        
        return [event];
    }

    createProgram() {
        // 创建一个简单的程序
        this.vm.aiBlockGenerator.createBlockSequence(this.targetId, [
            { opcode: 'event_whenflagclicked' },
            { opcode: 'motion_movesteps', fields: { STEPS: '100' } },
            { opcode: 'motion_turnright', fields: { ANGLE: '90' } }
        ]);
    }

    getStatistics() {
        const history = this.vm.aiBlockGenerator.getEventHistory(this.targetId);
        return {
            totalEvents: history.length,
            totalBlocks: this.blockCount,
            eventTypes: this.countEventTypes(history)
        };
    }

    countEventTypes(history) {
        const counts = {};
        history.forEach(event => {
            counts[event.type] = (counts[event.type] || 0) + 1;
        });
        return counts;
    }
}

// 使用
const controller = new AIBlockController(vm);
controller.initialize(vm.editingTarget.id);
controller.createProgram();
console.log(controller.getStatistics());
```

---

## 事件系统

### 事件类型

| 类型 | 说明 | 何时触发 |
|------|------|---------|
| create | 创建积木 | 用户拖拽积木或 AI 生成 |
| delete | 删除积木 | 用户删除积木或 AI 删除 |
| move | 移动积木 | 用户拖拽移动或 AI 移动 |
| change | 修改字段 | 用户修改参数或 AI 修改 |

### 事件生命周期

```
1. 生成阶段
   - Blockly 生成事件或 AI 生成事件
   - 事件对象创建

2. 拦截阶段
   - AIBlockDecider.process() 被调用
   - 检查是否启用 AI
   - 调用决策处理函数

3. 决策阶段
   - 决策处理函数执行
   - 可以修改、拒绝或生成事件
   - 返回事件数组

4. 处理阶段
   - _processBlocklyEvent() 处理每个事件
   - 更新 VM 状态
   - 创建/删除/移动积木

5. 通知阶段
   - 发出 PROJECT_CHANGED 事件
   - 触发 BLOCKS_NEED_UPDATE
   - GUI 接收更新

6. 渲染阶段
   - GUI 重新渲染
   - 显示新的积木结构
```

### 事件历史

- 最多保存 100 个事件
- 自动删除最旧的事件
- 可通过 `getEventHistory()` 查看
- 可通过 `clearEventHistory()` 清除

---

## 集成指南

### 步骤 1：初始化 VM

```javascript
const VirtualMachine = require('scratch-vm');
const vm = new VirtualMachine();
vm.start();
```

### 步骤 2：加载项目

```javascript
const projectData = require('./project.json');
await vm.loadProject(projectData);
```

### 步骤 3：获取目标 ID

```javascript
const targetId = vm.editingTarget.id;
console.log('Editing target:', targetId);
```

### 步骤 4：启用 AI（可选）

```javascript
vm.aiBlockGenerator.enableAI(targetId, (event, blocksContainer, context) => {
    // 你的 AI 逻辑
    return [event];
});
```

### 步骤 5：创建积木

```javascript
// 方式 1：创建单个积木
vm.aiBlockGenerator.createBlock(targetId, 'motion_movesteps', {
    fields: { STEPS: '10' }
});

// 方式 2：创建积木序列
vm.aiBlockGenerator.createBlockSequence(targetId, [
    { opcode: 'motion_movesteps', fields: { STEPS: '10' } },
    { opcode: 'motion_turnright', fields: { ANGLE: '90' } }
]);
```

### 步骤 6：监听项目变化

```javascript
vm.on('PROJECT_CHANGED', () => {
    console.log('Project changed');
});

vm.on('workspaceUpdate', (data) => {
    console.log('Workspace updated');
});
```

---

## 常见问题

### Q1：如何获取所有可用的积木操作码？

```javascript
// 从 runtime 获取所有已加载的积木
const blocks = vm.runtime.getBlocksInfo();
blocks.forEach(block => {
    console.log(block.opcode);
});
```

### Q2：如何知道积木的字段名称？

```javascript
// 查看 Scratch 官方文档或源代码
// 例如 motion_movesteps 的字段是 STEPS
// motion_turnright 的字段是 ANGLE
```

### Q3：如何连接两个积木？

```javascript
// 使用 moveBlock 将积木连接到另一个积木
vm.aiBlockGenerator.moveBlock(targetId, 'block_2', {
    parentId: 'block_1',
    inputName: null  // null 表示 next 连接
});
```

### Q4：如何获取积木的当前状态？

```javascript
// 从 blocks 容器获取
const block = vm.editingTarget.blocks.getBlock('block_123');
console.log(block);
```

### Q5：如何删除所有积木？

```javascript
// 获取所有顶级积木
const blocks = vm.editingTarget.blocks.getTopBlocks();

// 删除每个积木
blocks.forEach(block => {
    vm.aiBlockGenerator.deleteBlock(vm.editingTarget.id, block.id);
});
```

---

## 性能考虑

### 优化建议

1. **批量操作**
   - 使用 `createBlockSequence()` 而不是多次 `createBlock()`
   - 减少事件处理次数

2. **避免频繁更新**
   - 在决策处理器中避免耗时操作
   - 使用事件历史而不是频繁查询

3. **内存管理**
   - 定期清除事件历史
   - 避免创建过多积木

4. **事件处理**
   - 决策处理器应该快速返回
   - 避免在处理器中进行复杂计算

---

## 调试技巧

### 启用日志

```javascript
// 在决策处理器中添加日志
vm.aiBlockGenerator.enableAI(targetId, (event, blocksContainer, context) => {
    console.log('=== Event ===');
    console.log('Type:', event.type);
    console.log('BlockId:', event.blockId);
    console.log('Opcode:', event.opcode);
    console.log('History length:', context.eventHistory.length);
    console.log('================');
    
    return [event];
});
```

### 查看事件历史

```javascript
const history = vm.aiBlockGenerator.getEventHistory(targetId);
console.table(history);
```

### 检查积木状态

```javascript
const block = vm.editingTarget.blocks.getBlock('block_123');
console.log('Block:', block);
console.log('Fields:', block.fields);
console.log('Inputs:', block.inputs);
```

---

## 总结

这个 AI 积木系统提供了：

1. **灵活的 API** - 简单易用的公共接口
2. **事件拦截** - 在事件处理前进行 AI 决策
3. **事件生成** - AI 可以主动生成积木事件
4. **完整的历史** - 记录所有事件便于分析
5. **易于集成** - 无需修改现有代码

通过这个系统，AI 可以：
- 自动生成积木程序
- 修改用户创建的积木
- 阻止不合法的操作
- 学习用户的编程模式
- 提供智能建议


