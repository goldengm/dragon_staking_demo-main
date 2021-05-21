import { useEffect, useState } from 'react';
import useNotify from './notify'
import { useWallet } from "@solana/wallet-adapter-react";
import * as anchor from "@project-serum/anchor";
import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID} from "@solana/spl-token";
import { programs } from '@metaplex/js'
import moment from 'moment';
import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  ConfirmOptions,
  SYSVAR_CLOCK_PUBKEY,
  clusterApiUrl
} from "@solana/web3.js";
import axios from "axios"

let wallet : any
let conn = new Connection(clusterApiUrl('devnet'))
let notify : any
const { metadata: { Metadata } } = programs
const COLLECTION_NAME = "DD"
const TOKEN_METADATA_PROGRAM_ID = new anchor.web3.PublicKey(
  "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s"
)
const programId = new PublicKey('5ciB2RmY8wkjfycn8xAAuwz5ZF2KZ6Qjoavwrt5FgqyN')
const CREATOR_ONE = 'GP92LuwLzC9qjnoXSwHRYna5ppKr4sPcjCgXhPZeeVjV'
const idl = require('./solana_anchor.json')
const confirmOption : ConfirmOptions = {
    commitment : 'finalized',
    preflightCommitment : 'finalized',
    skipPreflight : false
}

let POOL = new PublicKey('ChK3Kj7LipVWwGonBixzabJBo3RyaAbWZquspp5zyTSS')
const createAssociatedTokenAccountInstruction = (
  associatedTokenAddress: anchor.web3.PublicKey,
  payer: anchor.web3.PublicKey,
  walletAddress: anchor.web3.PublicKey,
  splTokenMintAddress: anchor.web3.PublicKey
    ) => {
  const keys = [
    { pubkey: payer, isSigner: true, isWritable: true },
    { pubkey: associatedTokenAddress, isSigner: false, isWritable: true },
    { pubkey: walletAddress, isSigner: false, isWritable: false },
    { pubkey: splTokenMintAddress, isSigner: false, isWritable: false },
    {
      pubkey: anchor.web3.SystemProgram.programId,
      isSigner: false,
      isWritable: false,
    },
    { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    {
      pubkey: anchor.web3.SYSVAR_RENT_PUBKEY,
      isSigner: false,
      isWritable: false,
    },
  ];
  return new anchor.web3.TransactionInstruction({
    keys,
    programId: ASSOCIATED_TOKEN_PROGRAM_ID,
    data: Buffer.from([]),
  });
}

const getMetadata = async (
  mint: anchor.web3.PublicKey
    ): Promise<anchor.web3.PublicKey> => {
  return (
    await anchor.web3.PublicKey.findProgramAddress(
      [
        Buffer.from("metadata"),
        TOKEN_METADATA_PROGRAM_ID.toBuffer(),
        mint.toBuffer(),
      ],
      TOKEN_METADATA_PROGRAM_ID
    )
  )[0];
};

const getTokenWallet = async (
  wallet: anchor.web3.PublicKey,
  mint: anchor.web3.PublicKey
    ) => {
  return (
    await anchor.web3.PublicKey.findProgramAddress(
      [wallet.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mint.toBuffer()],
      ASSOCIATED_TOKEN_PROGRAM_ID
    )
  )[0];
};

async function sendTransaction(transaction : Transaction,signers : Keypair[]) {
  try{
    transaction.feePayer = wallet.publicKey
    transaction.recentBlockhash = (await conn.getRecentBlockhash('max')).blockhash;
    await transaction.setSigners(wallet.publicKey,...signers.map(s => s.publicKey));
    if(signers.length !== 0)
      await transaction.partialSign(...signers)
    const signedTransaction = await wallet.signTransaction(transaction);
    let hash = await conn.sendRawTransaction(await signedTransaction.serialize());
    await conn.confirmTransaction(hash);
    notify('success', 'Success!');
  } catch(err) {
    console.log(err)
    notify('error', 'Failed Instruction!');
  }
}

async function initPool() {
  console.log("+ initPool")
  let provider = new anchor.Provider(conn, wallet as any, confirmOption)
  let program = new anchor.Program(idl,programId,provider)
  let randomPubkey = Keypair.generate().publicKey
  let [pool,bump] = await PublicKey.findProgramAddress([randomPubkey.toBuffer()],programId)
  console.log("pool address", pool.toBase58())
  let transaction = new Transaction()
  transaction.add(
    program.instruction.initPool(
      new anchor.BN(bump),
      {
        accounts:{
          owner : wallet.publicKey,
          pool : pool,
          rand : randomPubkey,
          systemProgram : anchor.web3.SystemProgram.programId,
        }
      }
    )
  )
  await sendTransaction(transaction,[])
  return pool
}

async function updatePool(
  rewardMint : PublicKey,
  rewardAmount : number,
  period : number,
  startTime : string,
  stakeCollection : string,
  ){
  console.log("+ updatePool")
  let provider = new anchor.Provider(conn, wallet as any, confirmOption)
  let program = new anchor.Program(idl,programId,provider)
  let [pool,] = await PublicKey.findProgramAddress([pD.rand.toBuffer()],programId)
  let transaction = new Transaction()
  let start = new Date(startTime);
  transaction.add(
    await program.instruction.updatePool(
      new anchor.BN(rewardAmount*1e9),
      new anchor.BN(period),
      new anchor.BN(start.getTime()/1000),
      stakeCollection,
      {
        accounts:{
          owner : wallet.publicKey,
          pool : pool,
          rewardMint : rewardMint,
          systemProgram : anchor.web3.SystemProgram.programId,
        }
      }
    )
  )
  await sendTransaction(transaction,[])
  return pool
}

async function initCollection(
  creator: PublicKey,
  warrior: number,
  king: number,
  elder: number,
){
  console.log("+ initCollection")
  let provider = new anchor.Provider(conn, wallet as any, confirmOption)
  let program = new anchor.Program(idl,programId,provider)
  let [collectionData,bump] = await PublicKey.findProgramAddress([POOL.toBuffer(), creator.toBuffer()],programId)
  console.log(collectionData.toBase58())
  let transaction = new Transaction()
  transaction.add(
    program.instruction.initCollection(
      new anchor.BN(bump),
      [new anchor.BN(warrior), new anchor.BN(king), new anchor.BN(elder)],
      {
        accounts:{
          owner : wallet.publicKey,
          pool : POOL,
          creator : creator,
          collectionData : collectionData,
          systemProgram : anchor.web3.SystemProgram.programId,
        }
      }
    )
  )
  await sendTransaction(transaction,[])
}

async function initTerritory(
  seed: String
){
  console.log("+ initTerritory")
  let provider = new anchor.Provider(conn, wallet as any, confirmOption)
  let program = new anchor.Program(idl,programId,provider)
  let [territory,bump] = await PublicKey.findProgramAddress([POOL.toBuffer(), Buffer.from(seed)],programId)
  
  let transaction = new Transaction()
  transaction.add(
    program.instruction.initTerritory(
      new anchor.BN(bump),
      seed,
      {
        accounts:{
          owner : wallet.publicKey,
          pool : POOL,
          territory : territory,
          systemProgram : anchor.web3.SystemProgram.programId,
        }
      }
    )
  )
  await sendTransaction(transaction,[])
}

async function stake(
	nftData : any,
  lockPeriod: number,
  territoryName: String
	){
	console.log("+ stake")
	let provider = new anchor.Provider(conn, wallet as any, confirmOption)
  let program = new anchor.Program(idl,programId,provider)
  const [collectionData, ] = await anchor.web3.PublicKey.findProgramAddress([POOL.toBuffer(), new PublicKey(nftData.creator).toBuffer()], programId)
  const [territory, ] = await anchor.web3.PublicKey.findProgramAddress([POOL.toBuffer(), Buffer.from(territoryName)], programId)
  const [stakeData, bump] = await anchor.web3.PublicKey.findProgramAddress([POOL.toBuffer(), wallet.publicKey.toBuffer(), nftData.address.toBuffer()], programId)
  const metadata = await getMetadata(nftData.address)
  let transaction = new Transaction()
  if (await conn.getAccountInfo(stakeData) == null) {
    transaction.add(
      await program.instruction.initStakeData(
        new anchor.BN(bump),
        nftData.attributes[7].trait_type === "Rank" ? nftData.attributes[7].value : nftData.attributes[5].value,
        nftData.attributes[4].value,
        {
          accounts: {
            owner: wallet.publicKey,
            pool: POOL,
            collectionData: collectionData,
            territory: territory,
            nftMint: nftData.address,
            stakeData: stakeData,
            systemProgram: anchor.web3.SystemProgram.programId
          }
        } 
      )
    )
  }
  const userNftAccount = await getTokenWallet(wallet.publicKey,nftData.address)
  const poolNftAccount = await getTokenWallet(POOL,nftData.address)
  if (await conn.getAccountInfo(poolNftAccount) == null){
    transaction.add(createAssociatedTokenAccountInstruction(poolNftAccount, wallet.publicKey, POOL, nftData.address))
  }
  transaction.add(
    await program.instruction.stake(
      new anchor.BN(lockPeriod),
      nftData.attributes[7].trait_type === "Rank" ? nftData.attributes[7].value : nftData.attributes[5].value,
      {
        accounts: {
          owner : wallet.publicKey,
          pool : POOL,
          collectionData: collectionData,
          territory: territory,
          stakeData : stakeData,
          nftMint : nftData.address,
          metadata : metadata,
          userNftAccount : userNftAccount,
          poolNftAccount : poolNftAccount,
          tokenProgram : TOKEN_PROGRAM_ID,
          clock : SYSVAR_CLOCK_PUBKEY
        }
  	  }
    )
  )
  await sendTransaction(transaction, [])
}

async function unstake(
	nftData : any
	){
	console.log("+ unstake")
	let provider = new anchor.Provider(conn, wallet as any, confirmOption)
  let program = new anchor.Program(idl,programId,provider)
  const [collectionData, ] = await anchor.web3.PublicKey.findProgramAddress([POOL.toBuffer(), new PublicKey(nftData.creator).toBuffer()], programId)
  const [stakeData, ] = await anchor.web3.PublicKey.findProgramAddress([POOL.toBuffer(), wallet.publicKey.toBuffer(), nftData.address.toBuffer()], programId)
  const metadata = await getMetadata(nftData.address)
  let transaction = new Transaction()
  const userNftAccount = await getTokenWallet(wallet.publicKey,nftData.address)
  const poolNftAccount = await getTokenWallet(POOL,nftData.address)
  if (await conn.getAccountInfo(poolNftAccount) == null){
    transaction.add(createAssociatedTokenAccountInstruction(poolNftAccount, wallet.publicKey, POOL, nftData.address))
  }
  transaction.add(
    await program.instruction.unstake(
      {
        accounts: {
          owner : wallet.publicKey,
          pool : POOL,
          collectionData: collectionData,
          territory: nftData.territory,
          stakeData : stakeData,
          nftMint : nftData.address,
          metadata : metadata,
          userNftAccount : userNftAccount,
          poolNftAccount : poolNftAccount,
          tokenProgram : TOKEN_PROGRAM_ID,
          clock : SYSVAR_CLOCK_PUBKEY
        }
  	  }
    )
  )
  await sendTransaction(transaction, [])
}

async function getNftsForOwner(
  conn : any,
  owner : PublicKey
  ){
  console.log("+ getNftsForOwner")
  const nfts: any = []
  let provider = new anchor.Provider(conn, wallet as any, confirmOption)
  let program = new anchor.Program(idl,programId,provider)  
  const tokenAccounts = await conn.getParsedTokenAccountsByOwner(owner, {
    programId: TOKEN_PROGRAM_ID
  });
  for (let index = 0; index < tokenAccounts.value.length; index++) {
    try{
      const tokenAccount = tokenAccounts.value[index];
      const tokenAmount = tokenAccount.account.data.parsed.info.tokenAmount;

      if (tokenAmount.amount == "1" && tokenAmount.decimals == "0") {
        let nftMint = new PublicKey(tokenAccount.account.data.parsed.info.mint)
        const [stakeData, ] = await anchor.web3.PublicKey.findProgramAddress([nftMint.toBuffer(), wallet.publicKey.toBuffer(), POOL.toBuffer()], programId)
        if (await conn.getAccountInfo(stakeData) == null || (await program.account.stakeData.fetch(stakeData)).unstaked == true) {
          let [pda] = await anchor.web3.PublicKey.findProgramAddress([
            Buffer.from("metadata"),
            TOKEN_METADATA_PROGRAM_ID.toBuffer(),
            nftMint.toBuffer(),
          ], TOKEN_METADATA_PROGRAM_ID);
          const accountInfo: any = await conn.getParsedAccountInfo(pda);
          let metadata : any = new Metadata(owner.toString(), accountInfo.value);
          const { data }: any = await axios.get(metadata.data.data.uri)
          if (metadata.data.data.symbol == COLLECTION_NAME && metadata.data.data.creators[0].address === CREATOR_ONE) {
            const entireData = { ...data, creator: metadata.data.data.creators[0].address }
            nfts.push({address : nftMint, ...entireData })
          }
        }
      }
      nfts.sort(function (a: any, b: any) {
        if (a.name < b.name) { return -1; }
        if (a.name > b.name) { return 1; }
        return 0;
      })
    } catch(err) {
      continue;
    }
  }
  return nfts
}

async function getStakedNFTs(
  conn : any,
  owner : PublicKey
) {
  console.log("+ getStakedNfts")
  const nfts: any = []
  let provider = new anchor.Provider(conn, wallet as any, confirmOption)
  let program = new anchor.Program(idl,programId,provider)  
  let accounts = await conn.getProgramAccounts(programId,
    {
      dataSlice: {length: 0, offset: 0},
      filters: [{dataSize: 258},{memcmp:{offset:8,bytes:wallet.publicKey.toBase58()}}]
    }
  )
  console.log(accounts)
  for (let i = 0; i < accounts.length; i++) {
    try{
      let accountData = await program.account.stakeData.fetch(accounts[i].pubkey)

      if (accountData && !accountData.unstaked && accountData.owner.toBase58() === wallet.publicKey.toBase58()) {
        let [pda] = await anchor.web3.PublicKey.findProgramAddress([
          Buffer.from("metadata"),
          TOKEN_METADATA_PROGRAM_ID.toBuffer(),
          accountData.mint.toBuffer(),
        ], TOKEN_METADATA_PROGRAM_ID);
        const accountInfo: any = await conn.getParsedAccountInfo(pda);
        let metadata : any = new Metadata(POOL.toString(), accountInfo.value);
        const { data }: any = await axios.get(metadata.data.data.uri)
        if (metadata.data.data.symbol == COLLECTION_NAME && metadata.data.data.creators[0].address === CREATOR_ONE) {
          const entireData = { ...data, creator: metadata.data.data.creators[0].address }
          nfts.push({address : accountData.mint, territory: accountData.territory, power: accountData.realPower.toNumber(), lockPeriod: accountData.lockPeriod.toNumber(), ...entireData })
        }
      }
      nfts.sort(function (a: any, b: any) {
        if (a.name < b.name) { return -1; }
        if (a.name > b.name) { return 1; }
        return 0;
      })
    } catch(err) {
      continue;
    }
  }
  return nfts
}

let pD : any ;
async function getPoolData(
  callback : any
	){
	let wallet = new anchor.Wallet(Keypair.generate())
	let provider = new anchor.Provider(conn,wallet,confirmOption)
	const program = new anchor.Program(idl,programId,provider)
	let poolData = await program.account.pool.fetch(POOL)
  pD = {
    owner: poolData.owner,
    rand: poolData.rand,
    bump: poolData.bump
  }
  if(callback != null) callback();
}

let territoryData : any ;
async function getTerritory(
  territoryName: String,
  callback : any
	){
    console.log("get territory information")
	let provider = new anchor.Provider(conn,wallet,confirmOption)
	const program = new anchor.Program(idl,programId,provider)
  let [territory,] = await anchor.web3.PublicKey.findProgramAddress([POOL.toBuffer(), Buffer.from(territoryName)], programId)
	let data = await program.account.territory.fetch(territory)
  territoryData = {
    name: data.seed,
    fire: data.fire.toNumber(),
    water: data.water.toNumber(),
    earth: data.earth.toNumber(),
    air: data.air.toNumber(),
    dark: data.dark.toNumber(),
    celestial: data.celestial.toNumber(),
    lightning: data.lightning.toNumber(),
    cyborg: data.cyborg.toNumber()
  }
  if(callback != null) callback();
}

let nfts : any[] = []
let stakedNfts : any[] = []

async function getNfts(callback : any){
	nfts.splice(0,nfts.length)
  stakedNfts.splice(0,stakedNfts.length)
  await getPoolData(null)
	nfts = await getNftsForOwner(conn,wallet.publicKey)
  stakedNfts = await getStakedNFTs(conn,wallet.publicKey)
	console.log(nfts)
  console.log(stakedNfts)
	if(callback != null) callback();
}

let init = true;
export default function Stake(){
	wallet = useWallet()
	notify = useNotify()
	const [changed, setChange] = useState(true)
  const [creator, setCreator] = useState(CREATOR_ONE)
  const [warrior, setWarrior] = useState(10)
  const [king, setKing] = useState(100)
  const [elder, setElder] = useState(500)
  const [elderChild, setElderChild] = useState(0)
  const [seed, setSeed] = useState("A")
  const [lockPeriod, setLockPriod] = useState(0)

	const render = () => {
		setChange(!changed)
	}

	if(wallet.publicKey != undefined && init){
		init = false
		getNfts(render).then(() => {
      
    })
	}
	return <div className="container-fluid mt-4">
		<div className="row mb-3">
			<div className="col-lg-4">
				<button type="button" className="btn btn-warning m-1" onClick={async () =>{
					POOL = await initPool()
					render()
				}}>Create Staking Pool</button>
				<button type="button" className="btn btn-warning m-1" onClick={async () =>{
					await getPoolData(render)
				}}>Get Pool Data</button>
			</div>
			<div className="col-lg-4">
				Pool Address : {POOL ? POOL.toBase58() : ""}
			</div>
		</div>
    <hr/>
    {/* <div className="row">
      {
        pD &&
        <div className="col-lg-12">
          <h4>Pool Data</h4>
          <h5>{"owner : "+pD!.owner.toBase58()}</h5>
          <h5>{"rand : "+pD!.rand.toBase58()}</h5>
          <h5>{"bump : "+pD.bump}</h5>
        </div>
      }
    </div>
    <hr/> */}
    <div className="row mb-3">
      <div className="col-lg-6">
				<div className="input-group">
					<div className="input-group-prepend">
						<span className="input-group-text">Creator</span>
					</div>
					<input name="creator"  type="text" className="form-control" onChange={(event)=>{setCreator(event.target.value)}} value={creator}/>
				</div>
			</div>
    </div>
		<div className="row mb-3">
      <div className="col-lg-2">
				<div className="input-group">
					<div className="input-group-prepend">
						<span className="input-group-text">Warrior</span>
					</div>
					<input name="warrior"  type="number" className="form-control" onChange={(event)=>{setWarrior(Number(event.target.value))}} value={warrior}/>
				</div>
			</div>
      <div className="col-lg-2">
				<div className="input-group">
					<div className="input-group-prepend">
						<span className="input-group-text">King</span>
					</div>
					<input name="king"  type="number" className="form-control" onChange={(event)=>{setKing(Number(event.target.value))}} value={king}/>
				</div>
			</div>
      <div className="col-lg-2">
				<div className="input-group">
					<div className="input-group-prepend">
						<span className="input-group-text">Elder</span>
					</div>
					<input name="elder"  type="number" className="form-control" onChange={(event)=>{setElder(Number(event.target.value))}} value={elder}/>
				</div>
			</div>
      {/* <div className="col-lg-2">
				<div className="input-group">
					<div className="input-group-prepend">
						<span className="input-group-text">Elder Child</span>
					</div>
					<input name="elderChild"  type="number" className="form-control" onChange={(event)=>{setElderChild(Number(event.target.value))}} value={elderChild}/>
				</div>
			</div> */}
    </div>
		<div className="row mb-3">
			<div className="col-lg-4">
        <button type="button" className="btn btn-warning m-1" onClick={async () =>{
					await initCollection(new PublicKey(creator), warrior, king, elder)
					render()
				}}>Initialize Collection</button>
        {/* <button type="button" className="btn btn-warning m-1" onClick={async () =>{
					// await updateCollection(new PublicKey(creator), warrior, king, elder)
					render()
				}}>Update Collection</button> */}
			</div>
		</div>
    <hr/>
    <div className="row mb-3">
      <div className="col-lg-6">
				<div className="input-group">
					<div className="input-group-prepend">
						<span className="input-group-text">Territory Name</span>
					</div>
					<input name="seed"  type="text" className="form-control" onChange={(event)=>{setSeed(event.target.value)}} value={seed}/>
				</div>
			</div>
			<div className="col-lg-4">
        <button type="button" className="btn btn-warning m-1" onClick={async () =>{
					await initTerritory(seed)
					render()
				}}>Create Territory</button>
        <button type="button" className="btn btn-warning m-1" onClick={async () =>{
					await getTerritory(seed, render)
				}}>Get Territory Info</button>
			</div>
    </div>
    <hr/>
		<div className="row">
     {
        territoryData &&
        <div className="col-lg-12">
          <h4>Territory Data</h4>
          <h5>{"name : "+territoryData!.name}</h5>
          <h5>{"fire : "+territoryData!.fire}</h5>
          <h5>{"water : "+territoryData!.water}</h5>
          <h5>{"earth : "+territoryData!.earth}</h5>
          <h5>{"air : "+territoryData!.air}</h5>
          <h5>{"dark : "+territoryData!.dark}</h5>
          <h5>{"celestial : "+territoryData!.celestial}</h5>
          <h5>{"lightning : "+territoryData!.lightning}</h5>
          <h5>{"cyborg : "+territoryData!.cyborg}</h5>
        </div>
      }
		</div>
    <hr/>
		<div className="row">
			<div className="col-lg-6">
        <h4>NFTs in your wallet</h4>
				<div className="row">
				{
					nfts.map((nft,idx)=>{
						return <div className="card m-3" key={idx} style={{"width" : "250px"}}>
							<img className="card-img-top" src={nft.image} alt="Image Error"/>
							<div>
								<h6>{nft.name}</h6>
                <h6>Rank: {nft.attributes[7].trait_type === "Rank" ? nft.attributes[7].value : nft.attributes[5].value}</h6>
                lock period:
                <select onChange={(e:any) => setLockPriod(e.target.value)}>
                  <option value={0}>0 days</option>
                  <option value={8}>8 days</option>
                  <option value={28}>28 days</option>
                  <option value={88}>88 days</option>
                </select>
								<button type="button" className="btn btn-success" onClick={async ()=>{
                  console.log(lockPeriod)
									await stake(nft, lockPeriod, seed)
                  await getNfts(render)
								}}>Stake</button>
							</div>
						</div>
					})
				}
				</div>
			</div>
      <div className="col-lg-6">
        <h4>Staked NFTs</h4>
        <div className="row">
        {
          stakedNfts.map((nft,idx)=>{
            return <div className="card m-6 col-lg-3" key={idx} style={{"width" : "250px"}}>
              <img className="card-img-top" src={nft.image} alt="Image Error"/>
              <div>
                <h6>{nft.name}</h6>
                <h6>Power: {nft.power}</h6>
                <h6>Lock Period: {nft.lockPeriod}</h6>
                <button type="button" className="btn btn-success" onClick={async ()=>{
                  await unstake(nft)
                  await getNfts(render)
                }}>Unstake</button>
              </div>
            </div>
          })
        }
        </div>
      </div>
		</div>
	</div>
}