export function debounce(func: Function, timeout = 300) {
    let timer: ReturnType<typeof setTimeout>;
    return (...args: [args: any]) => {
        clearTimeout(timer);
        // @ts-ignore
        timer = setTimeout(() => func.apply(this, args), timeout);
    };
}

export interface ThreadPair{
    id:string;
    time: number;
    userMessage: string;
    botResponse: string;
    codeBlocks: CodeBlock[];
}

export interface CodeBlock{
    code:string;
    codeRef: HTMLElement;
    copied: boolean;
    surroundingText: string;
    language: string;
    parentId: string; // ThreadPair.id
    turnParentId: string; // assistant turnの data-message-id/data-testid
}

interface LastTarget{
    parentId: string;
    preIndex: number|null;
    updatedAt: number;
}


export class GPTThread{
    private observer: MutationObserver |null=null; // 新しいメッセージが追加されたか
    private threadItems= new Map<string,ThreadPair> () // スレッド内の履歴データ
    private assistantTurnRef: HTMLElement|null=null;
    private userRef: HTMLElement | null=null; // 対応するユーザー発言のDOM要素
    private tempUserMessage: string| null=null; // ユーザーがtextエリアに入力中のテキスト
    private tempPair: ThreadPair | null=null; // 現在生成中のThreadPair
    private lastEditedTime: ReturnType<typeof setTimeout> | null=null; // Botの出力が止まったことを検出
    private botObserver: MutationObserver | null=null;
    private lastTarget: LastTarget | null=null;


    constructor(readonly id:string,readonly title:string){
        this.init();
    }

    init(){
        this.initPageObserver();
        this.initListener();
    }

    // 画面上の一番最初の会話ターンを取得し、その親を返す
    private getThreadContainer(): HTMLElement|null{
        const firstTurn=document.querySelector(
            'article[data-testid^="conversation-turn-"]'
        ) as HTMLElement | null;

        return (firstTurn?.parentElement ?? null) as HTMLElement | null;
    }

    // ユーザの操作からparentIdを推測する
    initListener(){
        // 選択範囲が変わったらlastTargetも変更する
        document.addEventListener("selectionchange",()=>{
            const sel=window.getSelection();
            if(!sel||sel.rangeCount===0)return;

            // 選択が始まった位置のDOMノード
            const anchor=sel.anchorNode;
            if(!anchor)return;

            const resolved=this.resolveParentFromNode(anchor);
            if(!resolved)return;

            const pre =
                (anchor.nodeType === Node.ELEMENT_NODE
                    ? (anchor as Element)
                    : anchor.parentElement
                )?.closest("pre") as HTMLPreElement | null;

            const preIndex = pre
                ? Array.from(resolved.turn.querySelectorAll("pre")).indexOf(pre)
                : null

            this.lastTarget={
                parentId:resolved.parentId,
                preIndex,
                updatedAt: Date.now(),
            };
        });

        // backgroundからonMenuClickが発火 → messageを受け取る
        chrome.runtime.onMessage.addListener((msg,_sender,sendResponse)=>{
            if(msg?.kind==="RESOLVE_LAST_TARGET"){
                if(!this.lastTarget){
                    sendResponse({ok:false,reason:"no lastTarget"});
                    return true;
                }

                sendResponse({
                    ok:true,
                    parentId: this.lastTarget.parentId,
                    preIndex: this.lastTarget.preIndex,
                    updatedAt: this.lastTarget.updatedAt,
                });

                return true;
            }

            if(msg.kind==="FORCE_RESPONSE_THREADPAIR"){
                const parentId:string=msg.parentId;
                const preIndex:number|null=msg.preIndex;

                const result=this.threadItems.get(parentId);
                if(!result){
                    sendResponse({ ok: false, reason: "threadItem not found", parentId, preIndex });
                    return true;
                }
                sendResponse({ok:true,result:result});
                return true;
            }

            return false;
        });
    }


    initPageObserver(){
        const targetNode=this.getThreadContainer();
        if(!targetNode){
            setTimeout(()=>this.initPageObserver(),5000);
            return;
        }

        targetNode.dataset.gptThreadId = this.id; 
        if(!this.threadItems.size){
            this.initThreadItems(targetNode);
        }
        this.observer?.disconnect();

        this.observer?.disconnect();
        this.observer=new MutationObserver(this.handleMessages);
        this.observer.observe(targetNode,{childList:true,subtree:true});
        
        this.listenForUserText();
    }

    private readComposerText():string{
        const root = document.querySelector('#prompt-textarea') as HTMLElement | null;
        return(root?.textContent ?? '').trim();
    }

    listenForUserText(){
        document.addEventListener('input',debounce(()=>{
            this.tempUserMessage=this.readComposerText();
            console.log("tempUserMessage1:",this.tempUserMessage);
        },50),true);

        // コピペはpasteの後にDOMが更新される → 次フレーム
        document.addEventListener('paste',()=>{
            requestAnimationFrame(()=>{
                this.tempUserMessage=this.readComposerText();
                console.log("tempUserMessage2:",this.tempUserMessage);
            });
        },true);

        // beforeinputがinsertFromPasteのときも披露
        document.addEventListener('beforeinput',(e)=>{
            const ie=e as InputEvent;
            if((ie as any).inputType==='insertFromPaste'){
                requestAnimationFrame(()=>{
                    this.tempUserMessage=this.readComposerText();
                    console.log("tempUserMessage3:",this.tempUserMessage);
                });
            }
        },true);

        // IME確定も披露
        document.addEventListener('compositionend',()=>{
            requestAnimationFrame(()=>{
                this.tempUserMessage=this.readComposerText();
                console.log("tempUserMessage4:",this.tempUserMessage);
            });
        },true)
    }


    handleUserInput=(e:Event)=>{
        const el=e.target as HTMLElement | null;
        if(!el)return;

        const root = el.closest('#prompt-textarea') as HTMLElement | null;
        if(!root)return;

        const text=root.textContent ?? "";
        this.tempUserMessage=text;
        console.log("tempUserMessage:",this.tempUserMessage);
    }

    private getUserElFromTurn(turn:HTMLElement):HTMLElement|null{
        return turn.querySelector('[data-message-author-role="user"]') as HTMLElement | null;
    }

    private findNextAssistantTurn(fromTurn: HTMLElement): HTMLElement | null{
        let cur:Element | null=fromTurn.nextElementSibling;
        for(let i=0;i<8&&cur;i++){
            if(cur instanceof HTMLElement){
                const hasAssistant = !!cur.querySelector('[data-message-author-role="assistant"]');
                if (hasAssistant) {
                    console.log(cur);
                    return cur;
                }
            }

            cur=cur.nextElementSibling;
        }

        return null;
    }


    handleMessages: MutationCallback=(
        mutationList: MutationRecord[],
        observer:MutationObserver
    )=>{
        if(!mutationList.length)return;

        const msg=this.tempUserMessage;
        if(!msg||msg.length===0){
            console.log("stored user message=undefined:",this.tempUserMessage);
            return;
        }

        // 追加されたノードすべて
        for(const mutation of mutationList){
            const addedNodes=Array.from(mutation.addedNodes);
            for(const node of addedNodes){
                const el=
                    node.nodeType===Node.ELEMENT_NODE
                    ?(node as HTMLElement)
                    : node.parentElement;
                
                    if(!el)continue;

                // 会話ターンを特定
                const turn = el.closest('article[data-testid^="conversation-turn-"]') as HTMLElement | null;

                // ない場合は無視
                if(!turn){
                    console.log("el.closest(article)=null, el HTML:");
                    continue;
                }

                // ユーザーの送信文と一致判定
                const extracted=this.extractUserText(turn);
                if(extracted&&extracted===this.tempUserMessage){
                    console.log("ysessss");
                    // tempUserMessageと同じテキストを含むnodeが見つかった
                    this.userRef=this.getUserElFromTurn(turn);

                    const assistantTurn=this.findNextAssistantTurn(turn);
                    if(!assistantTurn){
                        console.log("assistant turn not found yet");
                        return;
                    }

                    this.assistantTurnRef=assistantTurn;

                    this.botObserver?.disconnect();
                    this.botObserver=new MutationObserver((mutations,observer)=>{
                        this.addToThread(mutations,observer)
                    });

                    // botのターンを監視
                    this.botObserver.observe(
                        assistantTurn,
                        {
                            childList:true,
                            subtree: true,
                            characterData: true,
                        }
                    );
                }
            }
        }
    }

    private reset(){
        this.userRef=null;
        this.assistantTurnRef=null;
        this.tempPair=null;
        this.tempUserMessage=null;
        this.botObserver?.disconnect();
    }

    addToThread(mutationList:MutationRecord[],observer: MutationObserver){
        this.tempPair=this.tempPair||{
            id: `${new Date().getTime().toString()}-${this.tempUserMessage}`,
            time: new Date().getTime(),
            userMessage:'',
            botResponse:'',
            codeBlocks:[],
        };

        const addedNodes=mutationList
            .filter((m)=>m.addedNodes&&m.addedNodes.length>0)
            .flatMap((m)=>Array.from(m.addedNodes));
        
        const preNode=
            (addedNodes.find((n)=>n.nodeName==="PRE")as HTMLPreElement|undefined)??
            (addedNodes
                .map((n)=>(n as HTMLElement).querySelector?.("pre")??null)
                .find(Boolean)as HTMLPreElement | null)??
            null;
        if(preNode){
            const codeBlock=this.makeCodeBlock(preNode,this.tempPair.id);
            this.tempPair={
                ...this.tempPair,
                codeBlocks: [...this.tempPair.codeBlocks, codeBlock],
            }
        }

        // 5秒間何もないなら生成が止まったとみなす
        this.lastEditedTime&&clearTimeout(this.lastEditedTime);
        this.lastEditedTime=setTimeout(()=>{
            // tempPairのすべてのcodeBlockに対してupdateCodeBlock
            const codeBlocks=this.tempPair?.codeBlocks.map((c)=>
            this.updateCodeBlock(c)
            );

            // threadItemsに追加するプロンプトと生成物のペア
            const botText = this.assistantTurnRef
                ? this.extractAssistantText(this.assistantTurnRef)
                : "";
            console.log("bot text:",botText);
            this.tempPair={
                ...this.tempPair,
                userMessage:this.userRef?.innerText || '',
                botResponse: botText,
                id: this.tempPair?.id || new Date().getTime().toString(),
                time: this.tempPair?.time || new Date().getTime(),
                codeBlocks: codeBlocks || [],
            };

            // bot側からparentIdを取得
            const key=
                this.assistantTurnRef?.getAttribute("data-message-id")
                ?? this.assistantTurnRef?.getAttribute("data-testid")
                ?? this.tempPair?.id
                ?? `${Date.now()}`;

            this.threadItems.set(key,this.tempPair!);
            console.log("threadItems after response:",this.threadItems);
            this.reset();
        },5000);

        
    }

    // codeBlockを上書き
    updateCodeBlock(codeBlock: CodeBlock){
        const innerText=codeBlock.codeRef.innerText;
        return{...codeBlock,code:innerText};
    }

    private extractUserText(turn: HTMLElement):string{
        return (
            turn.querySelector('[data-message-author-role="user"] .whitespace-pre-wrap')
            ?.textContent?.trim()
            ?? ""
        );
    }

    private extractAssistantText(turn: HTMLElement):string{
        const assistants=Array.from(
            turn.querySelectorAll<HTMLElement>('[data-message-author-role="assistant"]')
        );

        // data-message-author-role="assistant"かつplaceholderでない
        const real=assistants.find((el)=>{
            const mid=el.getAttribute("data-message-id")||"";
            if (mid.startsWith("placeholder-request-")) return false;

            const md=el.querySelector(".markdown");
            return !!md && (md.textContent?.trim().length ?? 0)>0;
        });

        const md = real?.querySelector(".markdown") as HTMLElement | null;
        return md?.textContent ?? real?.innerText ?? "";
    }

    private initThreadItems(container: HTMLElement){
        const turns=Array.from(
            container.querySelectorAll('article[data-testid^="conversation-turn-"]')
        ) as HTMLElement[];

        for(let i=0;i<turns.length;i++){
            const a=turns[i];
            if(a.getAttribute("data-turn")!=="user")continue;

            let b:HTMLElement| null=null;
            for(let j=i+1;j<turns.length;j++){
                if(turns[j].getAttribute("data-turn")==="assistant"){
                    b=turns[j];
                    break;
                }
            }
            if(!b)continue;


            const userMessage=this.extractUserText(a);
            const botMessage=this.extractAssistantText(b);

            const id = `${Date.now()}-${userMessage.slice(0, 30)}`;
            const preNodes=b.querySelectorAll("pre");
            const codeBlocks: CodeBlock[] = Array.from(preNodes).map((pre) => {
                return this.makeCodeBlock(pre, id);
            });

            // responseからparentIdを取得
            const key=b.getAttribute("data-message-id")
                ?? b.getAttribute("data-testid")
                ?? id;

            this.threadItems.set(key,{
                id,
                time: Date.now(),
                userMessage,
                botResponse: botMessage,
                codeBlocks,
            });
        }
        console.log("threadItems: ",this.threadItems);
    }

    destroyPageObserver(){
        this.observer?.disconnect();
    }

    private makeCodeBlock(preNode: HTMLPreElement, parentId: string): CodeBlock {
        // const codeNode = preNode?.querySelector('code');
        console.log('preNode', preNode, 'preNode.innerText', preNode.innerText);
        const codeNode=preNode.querySelector('code');
        const code=codeNode?.innerText?? '';
        const codeRef = preNode as HTMLElement;

        const surroundingText = codeRef?.innerText || '';
        
        const langClass=codeNode?.className ?? '';
        const language=langClass.replace('language-','');
        
        const turnParentId =
            preNode.closest('article[data-testid^="conversation-turn-"]')
                ?.getAttribute("data-message-id")
            ?? preNode.closest('article[data-testid^="conversation-turn-"]')
                ?.getAttribute("data-testid")
            ?? "";

        const codeBlock:CodeBlock = {
            code,
            codeRef: preNode,
            copied: false,
            surroundingText,
            language,
            parentId,
            turnParentId,
        };
        // console.log('adding this', codeBlock);
        //this.attachListeners(preNode, parentId);
        return codeBlock;
    }


    // nodeからparentIdを特定 (bot側のparentId)
    private resolveParentFromNode(node: Node):{parentId: string,turn:HTMLElement}|null{
        const el=
            node.nodeType===Node.ELEMENT_NODE
                ? (node as Element)
                : (node.parentElement ?? null);

        if(!el)return null;

        // nodeを包む一番近いelement
        let turn = el.closest('article[data-testid^="conversation-turn-"]') as HTMLElement | null;
        if(!turn)return null;

        if(turn.getAttribute("data-turn")==="user"){
            const assistant=this.findNextAssistantTurn(turn);
            if(assistant)turn=assistant;
        }

        const parentId=
            turn.getAttribute("data-message-id")??
            turn.getAttribute("data-testid")??
            "";
        
        if(!parentId)return null;

        return {parentId,turn};
    }    

}

