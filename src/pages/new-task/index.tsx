import { Sparkles } from 'lucide-react';

const taskExamples = ['排查一个线上问题', '调研 AI 工作台方案', '查询支付退款规则'];

export function NewTaskPage() {
  return (
    <div className="new-task-empty">
      <div className="empty-task-mark"><Sparkles /></div>
      <h1>从一个任务开始</h1>
      <p>描述你想完成的工作。可以是编码、调研，或者查询内部资料。</p>
      <div className="empty-task-examples">
        {taskExamples.map(example => <span key={example}>{example}</span>)}
      </div>
    </div>
  );
}
