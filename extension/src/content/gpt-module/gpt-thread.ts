export function debounce(func: Function, timeout = 300) {
    let timer: ReturnType<typeof setTimeout>;
    return (...args: [args: any]) => {
        clearTimeout(timer);
        // @ts-ignore
        timer = setTimeout(() => func.apply(this, args), timeout);
    };
}

interface ThreadPair{
    id:string;
    time: number;
    userMessage: string;
    botResponse: string;
    codeBlocks: CodeBlock[];
}

interface CodeBlock{
    code:string;
    codeRef: HTMLElement;
    copied: boolean;
    surroundingText: string;
    language: string;
    parentId: string;
}

// chatgptのページのUIに依存
const SELECTORS = {
  THREAD_CONTAINER: 'flex flex-col text-sm pb-25',
  TEXTAREA: '#prompt-textarea',
  COPY_TEXT: 'Copy code',
  COPIED_TEXT: 'Copied!',
}

export class GPTThread{
    private observer: MutationObserver |null=null; // 新しいメッセージが追加されたか
    private threadItems: ThreadPair[]=[]; // スレッド内の履歴データ
    private botRef: HTMLElement | null=null; // 生成中のBotメッセージのDOM要素
    private userRef: HTMLElement | null=null; // 対応するユーザー発言のDOM要素
    private tempUserMessage: string| null=null; // ユーザーがtextエリアに入力中のテキスト
    private tempPair: ThreadPair | null=null; // 現在生成中のThreadPair
    private lastEditedTime: ReturnType<typeof setTimeout> | null=null; // Botの出力が止まったことを検出
    private botObserver: MutationObserver | null=null;

    constructor(readonly id:string,readonly title:string){
        this.init();
    }

    init(){
        this.initPageObserver();
    }

    private getThreadContainer(): HTMLElement|null{
        const firstTurn=document.querySelector(
            'article[data-testid^="conversation-turn-"]'
        ) as HTMLElement | null;

        return (firstTurn?.parentElement ?? null) as HTMLElement | null;
    }


    initPageObserver(){
        const targetNode=this.getThreadContainer();
        /*const targetNode: HTMLElement | null=document.body.querySelector(
            SELECTORS.THREAD_CONTAINER
        );*/
        //console.log("targetNode.id=", targetNode?.id, "expected=", this.id);
        //console.log("targetNode.innerText head=", targetNode?.innerText?.slice(0, 150));

        if(!targetNode){
            setTimeout(()=>this.initPageObserver(),5000);
            return;
        }

        targetNode.dataset.gptThreadId = this.id; 
        if(!this.threadItems.length){
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

    handleMessages: MutationCallback=(
        mutationList: MutationRecord[],
        observer:MutationObserver
    )=>{
        if(!mutationList.length)return;
        console.log("handleMessages fires:",mutationList.length);

        for(const m of mutationList){
            const nodes=Array.from(m.addedNodes);
            const hasTextNode=nodes.some(n=>n.nodeType===Node.TEXT_NODE);
            /*if(hasTextNode){
                const ok=nodes.some((n)=>{
                    const el=n.nodeType===Node.ELEMENT_NODE
                    ?(n as Element)
                    :(n.parentElement as Element|null);
                    if(!el)return false;

                    console.log(el);
                    const turn = el.closest('article[data-testid^="conversation-turn-"]') as HTMLElement | null;
                    if(!turn)return false;

                    const userText=this.extractUserText(turn);
                    //console.log("userText:",userText);
                    return userText.length>0;
                });

                //console.log("convert to extractUserText:",ok);
            }*/
        }


        const msg=this.tempUserMessage;
        if(!msg||msg.length===0){
            console.log("stored user message=undefined:",this.tempUserMessage);
            return;
        }

        console.log("user message from textarea:",msg);
        
        mutationList.forEach((mutation)=>{
            if(
                // ノードが追加された
                mutation.addedNodes&& 
                mutation.addedNodes.length>0&&
                Array.from(mutation.addedNodes).some( // 追加されたノードの中にユーザーが入力した内容があるか
                    (n)=>
                    (n as HTMLElement).innerText===this.tempUserMessage &&
                    this.tempUserMessage.length
                )
            ){
                console.log("mutation",mutation);
                const addedNodes=Array.from(mutation.addedNodes);
                const nodeWithMessage=addedNodes.find(
                    (n)=>
                    (n as HTMLElement).innerText===this.tempUserMessage&&
                    this.tempUserMessage.length
                ) as HTMLElement;

                if(nodeWithMessage){
                    this.userRef=nodeWithMessage;
                    this.botRef=nodeWithMessage.nextSibling as HTMLElement;

                    // botの出力を監視するobserverの起動
                    this.botObserver=new MutationObserver((mutations,observer)=>{
                        this.addToThread(mutations,observer)
                    });

                    this.botObserver.observe(
                        nodeWithMessage.nextSibling as HTMLElement,
                        {
                            childList:true,
                            subtree: true,
                            characterData: true,
                        }
                    );
                }
            }
        });
    }

    private reset(){
        this.userRef=null;
        this.botRef=null;
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
        const hasPre=addedNodes.some((n)=>n.nodeName==='PRE');
        if(hasPre){
            const preNode=addedNodes.find(
                (n)=>n.nodeName==='PRE'
            ) as HTMLElement;
            const codeBlock=this.makeCodeBlock(preNode,this.tempPair.id);

            this.tempPair={
                ...this.tempPair,
                codeBlocks:[...this.tempPair.codeBlocks,codeBlock]
            }
        }

        // 5秒間何もないなら生成が止まったとみなす
        this.lastEditedTime&&clearTimeout(this.lastEditedTime);
        this.lastEditedTime=setTimeout(()=>{
            const codeBlocks=this.tempPair?.codeBlocks.map((c)=>
            this.updateCodeBlock(c)
            );

            // threadItemsに追加するプロンプトと生成物のペア
            this.tempPair={
                ...this.tempPair,
                userMessage:this.userRef?.innerText || '',
                botResponse: this.botRef?.innerText || '',
                id: this.tempPair?.id || new Date().getTime().toString(),
                time: this.tempPair?.time || new Date().getTime(),
                codeBlocks: codeBlocks || [],
            };

            this.threadItems.push(this.tempPair);
            console.log("threadItems after response:",this.threadItems);
            this.reset();
        },5000);
    }

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
        return(
             turn.querySelector('[data-message-author-role="assistant"] .markdown')
             ?.textContent?.trim()
            ?? ""
        );
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
                return this.makeCodeBlock(pre as HTMLElement, id);
            });

            this.threadItems.push({
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

    private makeCodeBlock(preNode: HTMLElement, parentId: string): CodeBlock {
        // const codeNode = preNode?.querySelector('code');
        console.log('preNode', preNode, 'preNode.innerText', preNode.innerText);
        const code = preNode?.innerText || '';
        const codeRef = preNode as HTMLElement;
        const surroundingText = codeRef?.innerText || '';
        const language = preNode?.innerText.split(' ')[0] || '';
        const codeBlock:CodeBlock = {
            code,
            codeRef: preNode,
            copied: false,
            surroundingText,
            language,
            parentId,
        };
        // console.log('adding this', codeBlock);
        //this.attachListeners(preNode, parentId);
        return codeBlock;
    }


}