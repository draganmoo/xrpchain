$(document).ready(() => {
    const serverUrl = "https://bsz3cqbhtcd8.usemoralis.com:2053/server";
    const appId = "GzPCR3QuvuujhWPCvoHLEgfwO6oWURkk5JvATfRO";
    Moralis.start({
        serverUrl,
        appId
    });

    async function logOut() {
        await Moralis.User.logOut();
        console.log("logged out");
    }

    

    $('#logout-moralis').first().on('click', function () {
        logOut();
    })

    $('#btn-login-moralis').first().on('click', function () {
        console.log("clicked");
        let user = Moralis.User.current();
        if (!user) {
            user = Moralis.authenticate({
                    signingMessage: "Log in using Moralis"
                })
                .then(function (user) {
                    console.log("logged in user:", user);
                    console.log(user.get("ethAddress"));
                    $.post("/register-metamask", {
                            user_wallet: user.get("ethAddress"),
                            id: user.id
                        })
                        .done(function (data) {
                            if (data["success"] == "yes") {
                                window.location.href = "/profile";
                            }
                        });
                })
                .catch(function (error) {
                    alert(JSON.stringify(error));
                });
        } else {
            console.log("Already logged in via moralis.")
            $.post("/register-metamask", {
                    user_wallet: user.get("ethAddress"),
                    id: user.id
                })
                .done(function (data) {
                    console.log("Data Loaded: " + data);
                    if (data["success"] == "yes") {
                        window.location.href = "/profile";
                    }
                });
        }
    })

    $("#frm-register").submit((event) => {
        event.preventDefault();

        $.ajax({
            type: 'POST',
            url: '/',
            data: $('#frm-register').serialize(),
            dataType: "json",
            success: (response) => {
                $('#frm-register')[0].reset();

                document.getElementById("check").innerHTML = response.Success;
                //ADD THIS CODE
                setTimeout(() => {
                    document.getElementById("check").innerHTML = "";
                }, 3000);
                if (response.Success == "You are regestered,You can login now.") {
                    document.getElementById("aa").click();
                };
            },
            error: () => {}
        })
    });

    $("#frm-login").submit((event) => {
        event.preventDefault();

        $.ajax({
            type: 'POST',
            url: '/login',
            data: $('#frm-login').serialize(),
            dataType: "json",
            success: (response) => {
                $('#frm-login')[0].reset();

                document.getElementById("check").innerHTML = response.Success;
                //ADD THIS CODE
                setTimeout(() => {
                    document.getElementById("check").innerHTML = "";
                }, 3000);
                if (response.Success == "Success!") {
                    document.getElementById("aa").click();
                };
            },
            error: () => {}
        })
    });

    $("#frm-forgot").submit((event) => {

        event.preventDefault();

        $.ajax({
            type: 'POST',
            url: '/forgetpass',
            data: $('#frm-forgot').serialize(),
            dataType: "json",
            success: (response) => {
                //alert("a");
                //console.log(response.Success);
                $('#frm-forgot')[0].reset();
                //alert("abc");
                document.getElementById("check").innerHTML = response.Success;

                setTimeout(() => {
                    document.getElementById("check").innerHTML = "";
                }, 3000);
                if (response.Success == "Password changed!") {
                    document.getElementById("aa").click();
                };
            },
            error: () => {}
        })
    });

});