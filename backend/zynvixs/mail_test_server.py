"""Explicit loopback-only SMTP/IMAP fixtures; never relays mail to the Internet.

Run: python -m zynvixs.mail_test_server
Use only with ZYNVIXS_MAIL_TEST=1 and the documented loopback configuration.
"""

from socketserver import StreamRequestHandler, ThreadingTCPServer
from threading import Thread, Event

MESSAGE = (
    b"From: fixture@example.invalid\r\nTo: reader@example.invalid\r\nSubject: Local fixture\r\n"
    b"Content-Type: text/plain; charset=utf-8\r\n\r\nControlled inbox message. This is a local test fixture, not an external email."
)


class LocalServer(ThreadingTCPServer):
    allow_reuse_address = True
    daemon_threads = True

    def __init__(self, port, handler):
        self.received = []
        super().__init__(("127.0.0.1", port), handler)


class SMTPTestHandler(StreamRequestHandler):
    def handle(self):
        self.connection.settimeout(20)
        self.wfile.write(b"220 localhost test SMTP\r\n")
        while True:
            line = self.rfile.readline()
            if not line:
                break
            cmd = line.decode(errors="replace").strip().upper()
            if cmd.startswith(("EHLO", "HELO", "MAIL", "RSET", "NOOP")):
                self.wfile.write(b"250 OK\r\n")
            elif cmd.startswith("RCPT"):
                if ".INVALID" not in cmd and "@LOCALHOST" not in cmd:
                    self.wfile.write(b"550 test recipients only\r\n")
                else:
                    self.wfile.write(b"250 OK\r\n")
            elif cmd == "DATA":
                self.wfile.write(b"354 send data\r\n")
                data = b""
                while True:
                    value = self.rfile.readline()
                    if value in {b".\r\n", b""}:
                        break
                    data += value
                    if len(data) > 1000000:
                        return
                self.server.received.append(data)
                self.wfile.write(b"250 queued locally; never relayed\r\n")
            elif cmd == "QUIT":
                self.wfile.write(b"221 bye\r\n")
                break
            else:
                self.wfile.write(b"500 unsupported test command\r\n")


class IMAPTestHandler(StreamRequestHandler):
    def handle(self):
        self.connection.settimeout(20)
        self.wfile.write(b"* PREAUTH local test ready\r\n")
        while True:
            line = self.rfile.readline()
            if not line:
                break
            parts = line.decode().strip().split()
            if len(parts) < 2:
                break
            tag = parts[0].encode()
            cmd = " ".join(parts[1:]).upper()
            if cmd == "CAPABILITY":
                self.wfile.write(b"* CAPABILITY IMAP4rev1\r\n" + tag + b" OK done\r\n")
            elif cmd.startswith(("SELECT", "EXAMINE")):
                self.wfile.write(
                    b"* 1 EXISTS\r\n* OK [UIDVALIDITY 1] valid\r\n"
                    + tag
                    + b" OK [READ-ONLY] selected\r\n"
                )
            elif cmd.startswith("UID SEARCH"):
                self.wfile.write(b"* SEARCH 1\r\n" + tag + b" OK done\r\n")
            elif cmd.startswith("UID FETCH"):
                self.wfile.write(
                    b"* 1 FETCH (UID 1 BODY[] {"
                    + str(len(MESSAGE)).encode()
                    + b"}\r\n"
                    + MESSAGE
                    + b")\r\n"
                    + tag
                    + b" OK done\r\n"
                )
            elif cmd == "LOGOUT":
                self.wfile.write(b"* BYE logout\r\n" + tag + b" OK bye\r\n")
                break
            elif cmd == "NOOP":
                self.wfile.write(tag + b" OK done\r\n")
            else:
                self.wfile.write(tag + b" BAD unsupported test command\r\n")


def main():
    servers = [LocalServer(1025, SMTPTestHandler), LocalServer(1143, IMAPTestHandler)]
    for server in servers:
        Thread(target=server.serve_forever, daemon=True).start()
    print(
        "LOCAL TEST ONLY. SMTP 127.0.0.1:1025, IMAP 127.0.0.1:1143. No mail is relayed. Ctrl+C stops."
    )
    try:
        Event().wait()
    except KeyboardInterrupt:
        pass
    finally:
        for server in servers:
            server.shutdown()
            server.server_close()


if __name__ == "__main__":
    main()
