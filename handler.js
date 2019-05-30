'use strict';

const {nopodofo: npdf, NPDFAnnotation, NPDFAnnotationFlag} = require('nopodofo')
const {join} = require("path")
const {readFileSync} = require("fs")
const {EventEmitter} = require('events')

class SignerSpec extends EventEmitter{
    constructor() {
        super()
        this.setup()
        this.certAndKeyMemory()
            .then(() => this.test())
            .then(() => this.emit('complete'))
            .catch(e => {
                this.emit('error', e)
            })
    }
    setup() {
        const config = new npdf.Configure()
        config.logFile('/tmp/debug.txt')
        config.enableDebugLogging = true;
    }

    loadDocument() {
        return new Promise(resolve => {
            const doc = new npdf.Document()
            doc.load(join(__dirname, './spec/test-documents/test.pdf'), {forUpdate: true}, async (e) => {
                if (e) throw(e.message)
                return resolve(doc)
            })
        })
    }

    async certAndKeyMemory() {
        const doc = await this.loadDocument()
        // Create an instance of Signer
        const rect = new npdf.Rect(0, 0, 10, 10),
            page = doc.getPage(1),
            annot = page.createAnnotation(NPDFAnnotation.Widget, rect)
        annot.flags = NPDFAnnotationFlag.Hidden | NPDFAnnotationFlag.Invisible
        // add image annotation.
        const field = new npdf.SignatureField(annot, doc)
        field.setReason('test')
        field.setLocation('here')
        field.setCreator('me')
        field.setFieldName('signer.sign')
        field.setDate()
        let signedPath = join("/tmp/signed.pdf")
        let signer = new npdf.Signer(doc, signedPath)
        signer.signatureField = field
        const certificate = Buffer.from(readFileSync(join(__dirname, './spec/test-documents/certificate.pem')))
        const pkey = Buffer.from(readFileSync(join(__dirname, './spec/test-documents/key.pem')))
        console.log(certificate.length + pkey.length)
        await new Promise((resolve, reject) => signer.loadCertificateAndKey(certificate, {pKey: pkey}, (e, l) => {
            if (e) {
                return reject(e)
            }
            signer.write(l, (e, d) => {
                if (e) {
                    return reject(e.message)
                } else {
                    let signed = new npdf.Document()
                    signed.load(signedPath, (e) => {
                        if (e instanceof Error) throw(e.message)
                        let writtenSignatureField = signed.getPage(1).getFields().filter((i) => i instanceof npdf.SignatureField)[0]
                        let docSignatureMode = signed.form.SigFlags
                        if(writtenSignatureField == null) {
                            return reject('written signature field null')
                        }
                        if(docSignatureMode !== 3) {
                            return reject('doc signature mode != 3')
                        }
                        return resolve()
                    })
                }
            })
        }))
    }

    async test() {
        const doc = await this.loadDocument()
        const rect = new npdf.Rect(0, 0, 10, 10),
            page = doc.getPage(1),
            annot = page.createAnnotation(NPDFAnnotation.Widget, rect)
        annot.flags = NPDFAnnotationFlag.Hidden | NPDFAnnotationFlag.Invisible
        // add image annotation.
        const field = new npdf.SignatureField(annot, doc)
        field.setReason('test')
        field.setLocation('here')
        field.setCreator('me')
        field.setFieldName('signer.sign')
        field.setDate()
        let signedPath = join("/tmp/signed.pdf")
        let signer = new npdf.Signer(doc, signedPath)
        signer.signatureField = field
        await new Promise((resolve, reject) => signer.loadCertificateAndKey(join(__dirname, './spec/test-documents/certificate.pem'), {pKey: join(__dirname, './spec/test-documents/key.pem')}, (e, l) => {
            if (e) {
                return reject(e.message);
            }
            signer.write(l, (e, d) => {
                if (e) {
                    return reject(e.message)
                } else {
                    let signed = new npdf.Document()
                    signed.load(signedPath, (e) => {
                        if (e instanceof Error) return reject(e.message)
                        let writtenSignatureField = signed.getPage(1).getFields().filter((i) => i instanceof npdf.SignatureField)[0]
                        let docSignatureMode = signed.form.SigFlags
                         if(writtenSignatureField == null) {
                            return reject('written signature field null')
                        }
                        if(docSignatureMode !== 3) {
                            return reject('doc signature mode != 3')
                        }
                        return resolve()
                    })
                }
            })
        }))
    }
}
async function handler(event)  {
    await new Promise((resolve, reject) => {
        const test =new SignerSpec()
        test.on('error', e => reject(e))
        test.on('complete', () => {
            // save to s3
            // do something ...
            resolve('complete')
        })
    })
};

module.exports.test = handler

