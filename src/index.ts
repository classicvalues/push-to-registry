import * as core from '@actions/core';
import * as exec from '@actions/exec';
import * as io from '@actions/io';
import { CommandResult } from './types';

export async function run(): Promise<void> {
    const imageToPush = core.getInput('image-to-push');
    const tag = core.getInput('tag') || 'latest';
    const registry = core.getInput('registry');
    const username = core.getInput('username');
    const password = core.getInput('password');    

    // get podman cli
    const podman = await io.which('podman', true);

    //check if images exist in podman's local storage
    const checkImages: CommandResult = await execute(podman, ['images', '--format', 'json']);
    if (checkImages.succeeded === false) {
        return Promise.reject(new Error(checkImages.reason));
    }    
    const parsedCheckImages = JSON.parse(checkImages.output);
    const imagesFound = parsedCheckImages.
                            filter(image => image.names && image.names.find(name => name.includes("alpine:latewst"))).
                            map(image => image.names);
    if (imagesFound.length === 0) {
        //check inside the docker daemon local storage
        const pullFromDocker: CommandResult = await execute(podman, ['pull', `docker-daemon:${imageToPush}:${tag}`]);
        if (pullFromDocker.succeeded === false) {
            return Promise.reject(new Error(`Unable to find the image to push`));
        }
    }

    // push image
    const registryUrl = `${registry.replace(/\/$/, '')}:${tag}`;
    const push: CommandResult = await execute(podman, ['push', '--creds', `${username}:${password}`, `${imageToPush}`, `${registryUrl}`]);
    if (push.succeeded === false) {
        return Promise.reject(new Error(push.reason));
    }
}

async function execute(executable: string, args: string[]): Promise<CommandResult> {
    let output = '';
    let error = '';
    
    const options: exec.ExecOptions = {};
    options.listeners = {
        stdout: (data: Buffer): void => {
            output += data.toString();
        },
        stderr: (data: Buffer): void => {
            error += data.toString();
        }
    };
    const exitCode = await exec.exec(executable, args, options);
    if (exitCode === 1) {
        return Promise.resolve({ succeeded: false, error });
    } 
    return Promise.resolve({ succeeded: true, output });
}

run().catch(core.setFailed);