import { BookOpen, GitBranch, Library, Plus } from 'lucide-react';

const collections = ['支付域知识', '客户与账户', '研发规范', '产品资料'];
const knowledgeSources = ['支付接口规范', 'payment-service', 'finance-pc', 'Kibana 支付日志'];

export function KnowledgePage() {
  return (
    <section className="knowledge-view">
      <div className="knowledge-shell">
        <header className="knowledge-hero">
          <div><span className="eyebrow">受控知识空间</span><h1>知识库</h1><p>把仓库、文档和内部数据组织成可复用资源，并保留每次回答的引用依据。</p></div>
          <button className="primary-action" type="button"><Plus />新建集合</button>
        </header>
        <div className="knowledge-layout">
          <aside className="collection-panel">
            <div className="panel-label"><span>知识集合</span><b>4</b></div>
            {collections.map((name, index) => (
              <button className={`collection-row${index === 0 ? ' active' : ''}`} key={name} type="button">
                <span className="collection-icon"><Library /></span>
                <span><strong>{name}</strong><small>{index === 0 ? '5 个来源 · 刚刚同步' : '3 个来源'}</small></span>
              </button>
            ))}
          </aside>
          <div className="collection-detail">
            <div className="collection-detail-head">
              <div><span className="eyebrow">当前集合</span><h2>支付域知识</h2></div>
              <button className="quiet-button" type="button">管理来源</button>
            </div>
            <div className="knowledge-source-list">
              {knowledgeSources.map((name, index) => (
                <button className="knowledge-source-row" key={name} type="button">
                  <span className="source-icon document">{index < 2 ? <BookOpen /> : <GitBranch />}</span>
                  <span><strong>{name}</strong><small>{index === 0 ? '内部文档 · 186 个片段' : '本地资源 · 已建立索引'}</small></span>
                  <span className="sync-fresh"><i />已同步</span>
                  <span className="row-more">···</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
