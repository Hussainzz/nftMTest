import axios from "axios";
import * as dotenv from "dotenv";
import prompts, { Answers } from "prompts";
import { isAddress } from "ethers";
import ora from "ora";

dotenv.config();

type OwnerInfo = {
  tokenId: string[];
  ownerAddress: string;
};

type OwnerNftOptions = {
  collectionAddress: string;
  chain?: string;
  format?: string;
  limit?: number;
  cursor?: string | null
};

type ApiResult = {
    ownerData: OwnerInfo[],
    cursor: string | null
}

async function fetchOwnerNfts(options: OwnerNftOptions): Promise<ApiResult> {
  try {
    const allOwners: OwnerInfo[] = [];
    const { collectionAddress } = options;
    const result = await axios.get(
      `${process.env.API_BASE}/${collectionAddress}/owners`,
      {
        headers: {
          "X-API-Key": process.env.API_TOKEN,
        },
        params: options,
      }
    );
    const { status, data } = result;
    let pageCursor = null;
    if (status === 200) {
      const { result, cursor } = data;
      pageCursor = cursor
      const existingOwners: { [key: string]: number } = {};
      result?.forEach((tokenInfo: any) => {
        const tokenOwner: string = tokenInfo?.owner_of;
        const token: string = tokenInfo?.token_id;
        if (tokenOwner in existingOwners) {
          allOwners[existingOwners[tokenOwner]].tokenId.push(token);
        } else {
          allOwners.push({
            tokenId: [tokenInfo?.token_id],
            ownerAddress: tokenOwner,
          });
          existingOwners[tokenOwner] = allOwners.length - 1;
        }
      });
    }
    return {
        ownerData: allOwners,
        cursor: pageCursor
    };
  } catch (error) {
    return {
        ownerData: [],
        cursor: null
    }
  }
}

const promptUser = async (name: string, message: string): Promise<string | null> => {
    const response: Answers<string> = await prompts({
      type: 'text',
      name: name,
      message: message,
    });
    return response[name] || null;
  };



const fetchData = async (options: OwnerNftOptions) => {
    let collectionAddress: string | null = options.collectionAddress;
    if(collectionAddress.length == 0){
        collectionAddress = await promptUser("collection", "Enter Collection Address To Get Unique Owner Wallet Address With Token Id They Own");
        if (!isAddress(collectionAddress)) {
            console.log("Invalid Collection Address");
            return;
        }
    }

    let limit: number = options.limit || 0;
    if(limit == 0){
        limit = 10;
        let userLimit: string | null = await promptUser("limit", "Enter Limit (Default 10): ");
        if (userLimit !== null){
            let l = parseInt(userLimit);
            if(!isNaN(l) && l > 0){
                limit = l;
            }
        }
    }
    
    const loadingInfo = ora('Please Wait... Fetching Info').start();
    const params: OwnerNftOptions = {
        ...options,
        collectionAddress,
        limit
    }
    const ownersResult:ApiResult = await fetchOwnerNfts(params);
    loadingInfo.succeed('');

    const {ownerData, cursor} = ownersResult;
    if(!ownerData?.length){
        console.log("No Data Available.. :(");
        return;
    }

    console.log(" ----------------- OWNER DATA --------------------")
    console.log(ownerData);

    if(cursor){
        const cursorRes:Answers<string> = await prompts({
            type: 'select',
            name: 'confirmation',
            message: 'Do you want to fetch next page?',
            choices: [
              { title: 'Yes', value: 'yes' },
              { title: 'No', value: 'no' },
            ],
        });
        if(cursorRes?.confirmation !== 'yes'){
            console.log("Bye 👋");
            return;
        }
        fetchData({
            ...params,
            cursor
        })
    }
};

const options: OwnerNftOptions = {
    collectionAddress: '',
    limit: 0,
    chain: "eth",
    format: "decimal"
}
fetchData(options);
